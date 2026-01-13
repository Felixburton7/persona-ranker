/**
 * Evaluation Set Parser
 * 
 * Loads and parses the pre-ranked evaluation set (eval_set.csv)
 * for use in automatic prompt optimization.
 */

import { EvalLead } from "./metrics";
import * as fs from "fs";
import * as path from "path";

export interface EvalSetData {
    leads: EvalLead[];
    companies: Map<string, { count: number; rankedCount: number }>;
    stats: {
        totalLeads: number;
        rankedLeads: number;
        irrelevantLeads: number;
        uniqueCompanies: number;
    };
}

/**
 * Parse the evaluation CSV into structured data.
 * Expected columns: Full Name, Title, Company, LI, Employee Range, Rank
 * Rank = number means ranked (1 = best), Rank = "-" means irrelevant
 */
export function parseEvalSet(csvContent: string): EvalSetData {
    const lines = csvContent.trim().split("\n");
    const headers = parseCSVLine(lines[0]);

    // Find column indices
    const nameIdx = findColumnIndex(headers, ["Full Name", "Name", "FullName"]);
    const titleIdx = findColumnIndex(headers, ["Title", "Job Title"]);
    const companyIdx = findColumnIndex(headers, ["Company", "Company Name"]);
    const rangeIdx = findColumnIndex(headers, ["Employee Range", "Employees", "Size"]);
    const rankIdx = findColumnIndex(headers, ["Rank", "Ground Truth Rank", "TruthRank"]);

    if (nameIdx === -1 || titleIdx === -1 || companyIdx === -1 || rankIdx === -1) {
        throw new Error(`Missing required columns. Found: ${headers.join(", ")}`);
    }

    const leads: EvalLead[] = [];
    const companies = new Map<string, { count: number; rankedCount: number }>();

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        const fullName = values[nameIdx]?.trim() || "";
        const title = values[titleIdx]?.trim() || "";
        const company = values[companyIdx]?.trim() || "";
        const employeeRange = rangeIdx !== -1 ? (values[rangeIdx]?.trim() || "") : "";
        const rankStr = values[rankIdx]?.trim() || "-";

        if (!fullName || !title || !company) continue;

        // Parse rank: number = ranked, "-" or empty = irrelevant
        let groundTruthRank: number | null = null;
        if (rankStr !== "-" && rankStr !== "") {
            const parsed = parseInt(rankStr, 10);
            if (!isNaN(parsed) && parsed > 0) {
                groundTruthRank = parsed;
            }
        }

        const lead: EvalLead = {
            id: generateStableId(fullName, company, title),
            fullName,
            title,
            company,
            employeeRange,
            groundTruthRank
        };

        leads.push(lead);

        // Track company stats
        const companyStats = companies.get(company) || { count: 0, rankedCount: 0 };
        companyStats.count++;
        if (groundTruthRank !== null) {
            companyStats.rankedCount++;
        }
        companies.set(company, companyStats);
    }

    const rankedLeads = leads.filter(l => l.groundTruthRank !== null).length;

    return {
        leads,
        companies,
        stats: {
            totalLeads: leads.length,
            rankedLeads,
            irrelevantLeads: leads.length - rankedLeads,
            uniqueCompanies: companies.size
        }
    };
}

/**
 * Load eval set from the _assets directory.
 */
import { fileURLToPath } from "url";

/**
 * Load eval set from the _assets directory.
 */
export function loadEvalSetFromFile(filePath?: string): EvalSetData {
    // Top priority: user provided path
    if (filePath && fs.existsSync(filePath)) {
        return parseEvalSet(fs.readFileSync(filePath, "utf-8"));
    }

    const filename = "eval_set.csv";

    const possiblePaths = [
        // 1. Explicit argument if passed
        ...(filePath ? [filePath] : []),

        // 2. Production/Vercel standard: public/data relative to CWD
        path.join(process.cwd(), "public", "data", filename),

        // 3. Fallback for potential weird CWD situations or local dev
        path.join(process.cwd(), "..", "public", "data", filename),

        // 4. Legacy/Asset location (keep as backup)
        path.join(process.cwd(), "_assets", "initial_documents", "eval_set.csv - Evaluation Set.csv"),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return parseEvalSet(fs.readFileSync(p, "utf-8"));
        }
    }

    throw new Error(`Eval set file not found: ${filename}. Searched in: ${possiblePaths.map(p => `\n- ${p}`).join("")}`);
}

/**
 * Parse a CSV line handling quoted values.
 */
function parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = "";
        } else {
            current += char;
        }
    }

    values.push(current);
    return values;
}

/**
 * Find column index by trying multiple possible header names.
 */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
    for (const name of possibleNames) {
        const idx = headers.findIndex(h =>
            h.toLowerCase().trim() === name.toLowerCase().trim()
        );
        if (idx !== -1) return idx;
    }
    return -1;
}

/**
 * Generate a stable ID from lead info (for matching predictions to ground truth).
 */
function generateStableId(fullName: string, company: string, title: string): string {
    const normalized = `${fullName.toLowerCase()}|${company.toLowerCase()}|${title.toLowerCase()}`
        .replace(/[^a-z0-9|]/g, "")
        .slice(0, 100);

    // Simple hash
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }

    return `eval_${Math.abs(hash).toString(36)}_${normalized.slice(0, 20)}`;
}

/**
 * Group eval leads by company for per-company evaluation.
 */
export function groupByCompany(leads: EvalLead[]): Map<string, EvalLead[]> {
    const grouped = new Map<string, EvalLead[]>();

    for (const lead of leads) {
        const existing = grouped.get(lead.company) || [];
        existing.push(lead);
        grouped.set(lead.company, existing);
    }

    return grouped;
}

/**
 * Extract ranking mismatches for gradient generation.
 */
export function findRankingMismatches(
    predictions: Map<string, { is_relevant: boolean; rank: number | null }>,
    groundTruth: EvalLead[]
): Array<{ lead: EvalLead; predictedRank: number; actualRank: number }> {
    const mismatches: Array<{ lead: EvalLead; predictedRank: number; actualRank: number }> = [];

    // Group by company
    const byCompany = groupByCompany(groundTruth);

    for (const [company, leads] of byCompany) {
        // Get ranked leads with predictions
        const rankedLeads = leads
            .filter(l => l.groundTruthRank !== null)
            .map(l => ({
                lead: l,
                actualRank: l.groundTruthRank!,
                pred: predictions.get(l.id)
            }))
            .filter(x => x.pred?.is_relevant && x.pred.rank !== null)
            .sort((a, b) => a.actualRank - b.actualRank);

        for (const item of rankedLeads) {
            const predictedRank = item.pred!.rank!;
            const actualRank = item.actualRank;

            // Significant mismatch: more than 2 positions off
            if (Math.abs(predictedRank - actualRank) > 2) {
                mismatches.push({
                    lead: item.lead,
                    predictedRank,
                    actualRank
                });
            }
        }
    }

    return mismatches.sort((a, b) =>
        Math.abs(b.predictedRank - b.actualRank) - Math.abs(a.predictedRank - a.actualRank)
    );
}
