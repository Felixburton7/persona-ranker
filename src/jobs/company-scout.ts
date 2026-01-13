import { task, metadata, wait } from "@trigger.dev/sdk/v3";
import { createServerClient } from "@/core/db/client";
import { logger } from "@/core/logger";
import {
    MAX_RANKING_POLL_ATTEMPTS,
    RANKING_POLL_INTERVAL_SECONDS,
    RANKING_STABILIZATION_WAIT_SECONDS,
    SCOUT_TASK_MAX_DURATION,
} from "@/core/constants";
import { scoutCompany, generatePersonalizedEmail, generateCompanySummary } from "@/features/scout";
import { ScoutTargetLead, ScoutData } from "@/types/leads";

interface CompanyScoutPayload {
    jobId: string;
    companyId: string;
    leadId?: string; // Optional: If provided, only scout this specific lead
    preferredModel?: string;
    apiKey?: string;
    geminiApiKey?: string;
}

export const companyScoutTask = task({
    id: "company-scout",
    maxDuration: SCOUT_TASK_MAX_DURATION,
    retry: {
        maxAttempts: 2,
    },
    run: async (payload: CompanyScoutPayload) => {
        const supabase = createServerClient();
        if (!supabase) throw new Error("Supabase credentials missing");
        const { jobId, companyId, leadId, preferredModel, apiKey, geminiApiKey } = payload;
        const sessionKeys = { groq: apiKey, gemini: geminiApiKey };
        const modelToUse = preferredModel || "gemini-2.0-flash";

        try {
            // 1. Fetch Company Info
            const { data: company, error: companyError } = await supabase
                .from("companies")
                .select("*")
                .eq("id", companyId)
                .single();

            if (companyError || !company) throw new Error("Company not found");
            metadata.set("company", company.name);

            // 2. Scrape Website
            let scrapedSummary = "";
            let scrapedContext = "";

            if (company.domain) {
                logger.info(`Scouting company domain`, { domain: company.domain });
                const result = await scoutCompany(company.domain);
                if (result) {
                    scrapedContext = result.context;
                    // Generate summary using the preferred model if specified
                    scrapedSummary = await generateCompanySummary(scrapedContext, modelToUse, sessionKeys);

                    // Update company with summary
                    await supabase
                        .from("companies")
                        .update({ scraped_summary: scrapedSummary })
                        .eq("id", companyId);

                    metadata.set("scouted", true);
                } else {
                    logger.warn(`Scouting returned no data`);
                    metadata.set("scouted", false);
                }
            } else {
                logger.warn(`No domain to scout`);
            }

            if (!scrapedContext) {
                logger.info(`No context to generate emails. Exiting.`);
                return;
            }

            // 3. Fetch Target Lead(s)
            let targetLeads: ScoutTargetLead[] = [];

            if (leadId) {
                // Specific lead provided - just fetch that one
                const { data: specificLead, error: leadError } = await supabase
                    .from("leads")
                    .select("*")
                    .eq("id", leadId)
                    .eq("company_id", companyId)
                    .single();

                if (leadError || !specificLead) {
                    logger.warn(`Specified lead not found. Exiting.`);
                    return;
                }

                targetLeads = [specificLead as ScoutTargetLead];
            } else {
                // Wait for ranking and fetch top leads
                logger.info(`Waiting for ranking results...`);

                let isRanked = false;
                let attempts = 0;

                while (!isRanked && attempts < MAX_RANKING_POLL_ATTEMPTS) {
                    const { count } = await supabase
                        .from("leads")
                        .select("*", { count: "exact", head: true })
                        .eq("company_id", companyId)
                        .not("rank_within_company", "is", null);

                    if (count && count > 0) {
                        await wait.for({ seconds: RANKING_STABILIZATION_WAIT_SECONDS });
                        isRanked = true;
                    } else {
                        await wait.for({ seconds: RANKING_POLL_INTERVAL_SECONDS });
                        attempts++;
                    }
                }

                if (!isRanked) {
                    logger.warn(`Timed out waiting for ranking.`);
                    return;
                }

                // Fetch Top Leads
                const { data: topLeads, error: leadsError } = await supabase
                    .from("leads")
                    .select("*")
                    .eq("company_id", companyId)
                    .not("rank_within_company", "is", null)
                    .order("rank_within_company", { ascending: true })
                    .limit(5);

                if (leadsError || !topLeads.length) return;

                // User requested just "one of them" for the section to appear
                // We'll just do the top ranked lead
                targetLeads = [topLeads[0] as ScoutTargetLead];
                logger.info(`Generating email for top lead`, { leadName: targetLeads[0].full_name });
            }

            // 4. Generate Emails
            interface ScoutUpdate {
                id: string;
                scout_data: ScoutData;
            }
            const updates: ScoutUpdate[] = [];
            for (const lead of targetLeads) {
                try {
                    const emailJson = await generatePersonalizedEmail(
                        {
                            full_name: lead.full_name,
                            title: lead.title,
                            company_name: company.name
                        },
                        scrapedContext,
                        modelToUse,
                        sessionKeys
                    );
                    const emailData = JSON.parse(emailJson);

                    const scoutData = {
                        scouted_at: new Date().toISOString(),
                        email_draft: {
                            subject: emailData.subject,
                            body: emailData.body
                        },
                        company_context_summary: scrapedSummary
                    };

                    updates.push({ id: lead.id, scout_data: scoutData });
                } catch (e: unknown) {
                    const error = e as Error;
                    logger.error(`Failed to generate email for lead`, { leadId: lead.id, error: error.message });
                }
            }

            // 5. Bulk Update Leads
            for (const update of updates) {
                await supabase
                    .from("leads")
                    .update({ scout_data: update.scout_data })
                    .eq("id", update.id);
            }

            logger.info(`Company Scout Task Completed.`);

        } catch (e: unknown) {
            const error = e as Error;
            logger.error(`Company Scout task failed`, { error: error.message });
            throw e;
        }
    }
});
