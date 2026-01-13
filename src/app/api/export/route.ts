import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/core/db/client";
import { stringify } from "csv-stringify/sync";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("job_id");
    const topN = parseInt(searchParams.get("top_n") || "3");

    if (!jobId) {
        return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
    }

    try {
        // 1. Identify companies involved in this job via ai_calls
        // This links the stateless job to the companies processed within it
        const { data: aiCalls, error: aiError } = await supabase
            .from("ai_calls")
            .select("company_id")
            .eq("job_id", jobId);

        if (aiError) {
            console.error("Error fetching job companies:", aiError);
            return NextResponse.json({ error: "Failed to fetch job data" }, { status: 500 });
        }

        if (!aiCalls || aiCalls.length === 0) {
            return NextResponse.json({ error: "No processed data found for this job" }, { status: 404 });
        }

        const companyIds = Array.from(new Set(aiCalls.map(c => c.company_id)));

        // 2. Fetch leads for these companies
        // We only want relevant leads, sorted by rank/score
        const { data: leads, error: leadsError } = await supabase
            .from("leads")
            .select(`
                *,
                companies ( name, size_bucket, industry, domain )
            `)
            .in("company_id", companyIds)
            // .eq("is_relevant", true) // Optional: export everything or just relevant? Usually just relevant.
            .order("relevance_score", { ascending: false });

        if (leadsError) {
            console.error("Error fetching leads:", leadsError);
            return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
        }

        // 3. Process and Limit per company
        const leadsByCompany = new Map<string, any[]>();

        for (const lead of leads) {
            const cid = lead.company_id;
            if (!leadsByCompany.has(cid)) {
                leadsByCompany.set(cid, []);
            }
            const current = leadsByCompany.get(cid)!;
            // Apply Top N limit per company (if topN is not -1)
            if (topN === -1 || current.length < topN) {
                current.push(lead);
            }
        }

        // Flatten for CSV
        const flattenLeads = [];
        for (const companyLeads of leadsByCompany.values()) {
            flattenLeads.push(...companyLeads);
        }

        // 4. Generate CSV
        const csvData = flattenLeads.map(l => ({
            Company: l.companies ? l.companies.name : "Unknown",
            Domain: l.companies ? l.companies.domain : "",
            "Size Bucket": l.companies ? l.companies.size_bucket : "",
            "Lead Name": `${l.first_name || ""} ${l.last_name || ""}`.trim(),
            Title: l.title,
            "Normalized Title": l.title_normalized,
            "Relevant?": l.is_relevant ? "Yes" : "No",
            Score: l.relevance_score,
            Reasoning: l.reasoning,
            LinkedIn: l.linkedin_url || ""
        }));

        const csvString = stringify(csvData, { header: true });

        // Return CSV file
        return new NextResponse(csvString, {
            status: 200,
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="export-${jobId}.csv"`,
            },
        });

    } catch (e) {
        console.error("Export failed:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
