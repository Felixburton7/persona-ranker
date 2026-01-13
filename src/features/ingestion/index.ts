import { parse } from "csv-parse/sync";
import { supabase } from "@/core/db/client";
import { tasks } from "@trigger.dev/sdk/v3";
import { generateCanonicalKey } from "./normalization/company";
import { normalizeSizeBucket } from "./normalization/size";
import { ValidationError, DatabaseError } from "@/core/errors";
import type { rankCompanyTask } from "@/jobs/rank-company";

// Define the input CSV row type based on leads.csv
// Headers: account_name,lead_first_name,lead_last_name,lead_job_title,account_domain,account_employee_range,account_industry
interface CSVRow {
    account_name: string;
    lead_first_name: string;
    lead_last_name: string;
    lead_job_title: string;
    account_domain: string;
    account_employee_range: string;
    account_industry: string;
}

export async function processCsvUpload(fileContent: string, preferredModel?: string, apiKey?: string, geminiApiKey?: string) {
    // 1. Parse CSV
    const rows = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    }) as CSVRow[];

    if (!rows.length) throw new Error("CSV is empty");

    // CSV columns validation
    const requiredColumns = [
        "account_name",
        "lead_first_name",
        "lead_last_name",
        "lead_job_title",
        "account_domain",
        "account_employee_range",
        "account_industry"
    ];
    // Check for missing columns
    const actualColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const missing = requiredColumns.filter(col => !actualColumns.includes(col));
    if (missing.length > 0) {
        throw new Error(
            [
                "❌ Invalid CSV format!\n",
                "Missing column(s):",
                ...missing.map(col => `  • ${col}`),
                "\nExpected columns:",
                `  ${requiredColumns.join(", ")}`,
            ].join("\n")
        );
    }

    // 2. Group by Company (using canonical key)
    interface CompanyGroup {
        info: {
            name: string;
            domain: string;
            employee_range: string;
            industry: string;
            canonical_key: string;
            size_bucket: string | null;
        };
        leads: ParsedLead[];
    }

    interface ParsedLead {
        first_name: string;
        last_name: string;
        title: string;
        linkedin_url: string;
        raw_json: CSVRow;
    }

    const companyGroups = new Map<string, CompanyGroup>();

    for (const row of rows) {
        const canonicalKey = generateCanonicalKey(row.account_name, row.account_domain);

        if (!companyGroups.has(canonicalKey)) {
            companyGroups.set(canonicalKey, {
                info: {
                    name: row.account_name,
                    domain: row.account_domain,
                    employee_range: row.account_employee_range,
                    industry: row.account_industry,
                    canonical_key: canonicalKey,
                    size_bucket: normalizeSizeBucket(row.account_employee_range),
                },
                leads: [],
            });
        }

        companyGroups.get(canonicalKey)!.leads.push({
            first_name: row.lead_first_name,
            last_name: row.lead_last_name,
            title: row.lead_job_title,
            linkedin_url: "", // Not in provided CSV headers? Check if available in extended csv
            // leads.csv -> account_name,lead_first_name,lead_last_name,lead_job_title,account_domain,account_employee_range,account_industry
            // No linkedin_url in these headers.
            raw_json: row
        });
    }

    // 3. Create Ranking Job (with preferred model if specified)
    const { data: job, error: jobError } = await supabase
        .from("ranking_jobs")
        .insert({
            status: "pending",
            total_companies: companyGroups.size,
            total_leads: rows.length,
            started_at: new Date().toISOString(),
            preferred_model: preferredModel || null,
        })
        .select()
        .single();

    if (jobError || !job) throw new Error("Failed to create ranking job: " + jobError?.message);


    // 4. Batch Persist Companies and Leads
    interface RankCompanyPayload {
        jobId: string;
        companyId: string;
        useCompanyScout: boolean;
        preferredModel?: string;
        apiKey?: string;
        geminiApiKey?: string;
    }
    const triggers: { payload: RankCompanyPayload }[] = [];

    // We process companies sequentially or in parallel?
    // Upsert companies first.
    // [MODIFICATION] We append "-<jobId>" to the canonical_key to ensure ISOLATION between jobs.
    // This effectively makes the ranker "Browser Specific" (strictly, Job Specific) rather than Global.
    // Two users ranking "Acme Corp" at the same time will create two distinct "Acme Corp" entries
    // with different IDs, preventing them from overwriting each other's leads.
    const companiesToUpsert = Array.from(companyGroups.values()).map(g => ({
        name: g.info.name,
        domain: g.info.domain,
        canonical_key: `${g.info.canonical_key}-${job.id}`, // Scoped to Job ID
        employee_range: g.info.employee_range,
        size_bucket: g.info.size_bucket,
        industry: g.info.industry,
    }));

    // Upsert companies and return IDs
    const { data: upsertedCompanies, error: companyError } = await supabase
        .from("companies")
        .upsert(companiesToUpsert, { onConflict: "canonical_key" })
        .select("id, canonical_key");

    if (companyError) throw new Error("Failed to upsert companies: " + companyError.message);

    const companyIdMap = new Map(upsertedCompanies.map(c => [c.canonical_key, c.id]));

    // Now insert leads
    const allLeads = [];
    for (const group of companyGroups.values()) {
        const scopedKey = `${group.info.canonical_key}-${job.id}`; // Match the scoped key
        const companyId = companyIdMap.get(scopedKey);
        if (!companyId) continue; // Should not happen

        triggers.push({
            payload: {
                jobId: job.id,
                companyId,
                useCompanyScout: true,
                preferredModel: preferredModel || undefined,
                apiKey: apiKey || undefined,
                geminiApiKey: geminiApiKey || undefined,
            },
        });

        for (const lead of group.leads) {
            allLeads.push({
                ...lead,
                company_id: companyId,
            });
        }
    }

    // Batch insert leads
    // Truncate leads table? No, append?
    // Requirement: "Upsert Company -> Insert Leads".
    // If we re-upload, we might duplicate leads if we just insert.
    // Ideally, valid leads should be deduplicated? 
    // leads table doesn't have a unique key other than ID.
    // We should maybe hash the row or just allow duplicates for now (simple MVP).
    // Or clear leads for these companies? "ON DELETE CASCADE".
    // Let's just insert.

    // Clear existing leads for these companies to prevent duplication and token overflow
    const companyIds = Array.from(companyIdMap.values());
    if (companyIds.length > 0) {
        const { error: deleteError } = await supabase
            .from("leads")
            .delete()
            .in("company_id", companyIds);

        if (deleteError) throw new Error("Failed to clear existing leads: " + deleteError.message);

        // Link companies to job immediately for UI visibility
        const currentTimestamp = new Date().toISOString();
        const initCalls = companyIds.map(cid => ({
            job_id: job.id,
            company_id: cid,
            call_type: "system_init",
            model: "system-init",
            input_tokens: 0,
            output_tokens: 0,
            estimated_cost_usd: 0,
            created_at: currentTimestamp
        }));

        const { error: linkError } = await supabase.from("ai_calls").insert(initCalls);
        if (linkError) console.warn("Failed to link companies to job:", linkError);
    }

    const { error: leadsError } = await supabase.from("leads").insert(allLeads);
    if (leadsError) throw new Error("Failed to insert leads: " + leadsError.message);

    // 5. Trigger Batch Task
    try {
        const batch = await tasks.batchTrigger<typeof rankCompanyTask>(
            "rank-company",
            triggers
        ); // batchTrigger returns a batchHandle

        // Update job with trigger batch info
        await supabase
            .from("ranking_jobs")
            .update({ trigger_batch_id: batch.batchId })
            .eq("id", job.id);

        // Scout will be triggered by the last rank-company task after all ranking completes

    } catch (e) {
        console.error("Trigger failed", e);
        // Update job to failed so UI shows error
        await supabase
            .from("ranking_jobs")
            .update({
                status: "failed",
                error: (e as Error).message || "Failed to start ranking process"
            })
            .eq("id", job.id);
    }

    return { jobId: job.id };
}
