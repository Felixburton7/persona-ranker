import { SupabaseClient } from "@supabase/supabase-js";
import { LLMResult, MappedResult, LLMRoleType } from "@/types/ranking";
import { logger } from "@/core/logger";
import { RELEVANCE_SCORE_THRESHOLD, DECISION_MAKER_SCORE_THRESHOLD } from "@/core/constants";

// Re-export types for backward compatibility
export type { LLMResult, LLMResponse, MappedResult } from "@/types/ranking";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Maps LLM results (with short IDs) back to real UUIDs.
 * Handles missing/invalid IDs gracefully.
 */
export function mapResults(
    results: LLMResult[],
    idMap: Map<number, string>,
    batch: Array<{ id: string }>
): MappedResult[] {
    const mapped: MappedResult[] = [];
    const seenIds = new Set<string>();

    // Process returned results
    for (const rawRes of results) {
        const res = rawRes as any;
        const realId = idMap.get(Number(res.id)); // Coerce to number just in case

        if (!realId) {
            logger.warn(`Invalid short ID - skipping`, { id: res.id });
            continue;
        }

        if (seenIds.has(realId)) {
            logger.warn(`Duplicate ID - skipping`, { id: res.id });
            continue;
        }

        // Normalize is_relevant based on score and string coercion
        let isRelevant = res.is_relevant;
        if (typeof isRelevant === "string") {
            isRelevant = isRelevant.toLowerCase() === "true";
        }

        // If score is high but is_relevant is false/missing, trust the score
        const score = Number(res.score) || 0;
        if (score >= RELEVANCE_SCORE_THRESHOLD && !isRelevant) {
            isRelevant = true;
        }

        // Ensure role_type is valid
        const roleType: LLMRoleType = ["decision_maker", "champion", "irrelevant"].includes(res.role_type)
            ? res.role_type
            : (score >= DECISION_MAKER_SCORE_THRESHOLD ? "decision_maker" : score >= RELEVANCE_SCORE_THRESHOLD ? "champion" : "irrelevant");

        seenIds.add(realId);
        mapped.push({
            realId,
            result: {
                id: Number(res.id),
                is_relevant: !!isRelevant,
                role_type: roleType,
                score: score,
                rank_within_company: typeof res.rank_within_company === 'number' ? res.rank_within_company : null,
                rubric: res.rubric || { department_fit: 0, seniority_fit: 0, size_fit: 0 },
                flags: Array.isArray(res.flags) ? res.flags : [],
                reasoning: res.reasoning || ""
            }
        });
    }

    // Fill missing candidates with defaults
    for (const candidate of batch) {
        if (!seenIds.has(candidate.id)) {
            logger.warn(`Missing result for candidate - filling default`);
            mapped.push({
                realId: candidate.id,
                result: {
                    id: 0,
                    is_relevant: false,
                    role_type: "irrelevant",
                    score: 0,
                    rank_within_company: null,
                    rubric: { department_fit: 0, seniority_fit: 0, size_fit: 0 },
                    flags: [],
                    reasoning: "Not processed by model",
                },
            });
        }
    }

    return mapped;
}

export function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

export async function updateJobProgress(
    supabase: SupabaseClient,
    jobId: string,
    companies: number,
    leads: number
) {
    await supabase.rpc("increment_job_progress", {
        p_job_id: jobId,
        p_companies: companies,
        p_leads: leads,
    });
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
