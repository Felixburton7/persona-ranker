/**
 * rank-company.ts - Ranks leads for a single company
 * 
 * Key design decisions:
 * 1. Uses SHORT NUMERIC IDs (1,2,3) in prompts to prevent LLM hallucination
 * 2. Batches leads to stay within context limits
 * 3. Strict provider mode (Gemini-only if Gemini selected)
 * 4. Graceful error handling with partial completion support
 */

import { task, metadata, tasks } from "@trigger.dev/sdk/v3";
import { createServerClient } from "@/core/db/client";
import { extractJsonResponse, estimateCost, completionWithRetry, LLM_MODEL } from "@/features/ai/client";
import { buildRankingPrompt, CandidateInput } from "@/features/ranking/prompt";
import { prefilterLead } from "@/features/ranking/prefilter";
import { normalizeTitle } from "@/features/ingestion/normalization/title";
import { companyScoutTask } from "./company-scout";
import {
    LLMResult,
    LLMResponse,
    mapResults,
    chunkArray,
    updateJobProgress,
    sleep
} from "@/features/ranking/utils";

// ============================================================================
// TYPES
// ============================================================================

interface RankCompanyPayload {
    jobId: string;
    companyId: string;
    useCompanyScout?: boolean;
    preferredModel?: string;
    apiKey?: string;
    geminiApiKey?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BATCH_SIZE = 15;  // Leads per batch (smaller = more reliable)
const MAX_RETRY_ATTEMPTS = 3;

// ============================================================================
// MAIN TASK
// ============================================================================

export const rankCompanyTask = task({
    id: "rank-company",
    maxDuration: 300,
    retry: { maxAttempts: 3, minTimeoutInMs: 1000, maxTimeoutInMs: 10000 },

    run: async (payload: RankCompanyPayload) => {
        const supabase = createServerClient();
        if (!supabase) throw new Error("Supabase credentials missing");

        const { jobId, companyId, preferredModel, apiKey, geminiApiKey, useCompanyScout } = payload;
        const sessionKeys = { groq: apiKey, gemini: geminiApiKey };
        const selectedModel = preferredModel || LLM_MODEL;

        try {
            // Update job status to running (only if still pending)
            await supabase
                .from("ranking_jobs")
                .update({ status: "running" })
                .eq("id", jobId)
                .eq("status", "pending");

            // 1. Fetch company and leads
            const { data: company, error: companyError } = await supabase
                .from("companies")
                .select("*")
                .eq("id", companyId)
                .single();

            if (companyError || !company) {
                throw new Error(`Company ${companyId} not found`);
            }

            const { data: leads, error: leadsError } = await supabase
                .from("leads")
                .select("*")
                .eq("company_id", companyId);

            if (leadsError || !leads?.length) {
                throw new Error(`No leads for company ${companyId}`);
            }

            metadata.set("company", company.name);
            metadata.set("totalLeads", leads.length);

            // 2. Pre-filter leads (deterministic exclusions)
            const candidates: Array<typeof leads[0] & { title_normalized: string }> = [];
            const excluded: any[] = [];

            for (const lead of leads) {
                const normalizedTitle = normalizeTitle(lead.title);
                const filter = prefilterLead(lead.title, normalizedTitle, company.size_bucket);

                if (filter.shouldExclude) {
                    excluded.push({
                        id: lead.id,
                        title: lead.title,
                        title_normalized: normalizedTitle,
                        excluded_by_gate: true,
                        exclusion_reason: filter.reason,
                        is_relevant: false,
                        role_type: "irrelevant",
                        relevance_score: 0,
                        reasoning: `Excluded: ${filter.reason}`,
                        ranked_at: new Date().toISOString(),
                    });
                } else {
                    candidates.push({ ...lead, title_normalized: normalizedTitle });
                }
            }

            // Save excluded leads
            if (excluded.length > 0) {
                await supabase.from("leads").upsert(excluded, { onConflict: "id" });
                await updateJobProgress(supabase, jobId, 0, excluded.length);
            }

            // 3. If no candidates, we're done with this company
            if (candidates.length === 0) {
                await updateJobProgress(supabase, jobId, 1, 0);

                // Check if ALL companies are done
                const { data: jobData } = await supabase
                    .from("ranking_jobs")
                    .select("total_companies, processed_companies")
                    .eq("id", jobId)
                    .single();

                if (jobData && jobData.processed_companies >= jobData.total_companies) {
                    await supabase
                        .from("ranking_jobs")
                        .update({
                            status: "completed",
                            completed_at: new Date().toISOString(),
                        })
                        .eq("id", jobId);
                }

                return { status: "success", companyId, leadsRanked: leads.length, relevant: 0 };
            }

            // 4. Process candidates in batches
            const batches = chunkArray(candidates, BATCH_SIZE);
            const allResults: Array<{ realId: string; result: LLMResult }> = [];
            let rateLimitHit = false;

            console.log(`Processing ${candidates.length} candidates in ${batches.length} batches using ${selectedModel}`);

            for (const [batchIdx, batch] of batches.entries()) {
                if (rateLimitHit) break;

                // Build prompt with short IDs
                const candidateInputs: CandidateInput[] = batch.map(c => ({
                    id: c.id,
                    full_name: c.full_name,
                    title: c.title,
                }));

                const { prompt, idMap } = buildRankingPrompt(company, candidateInputs);

                // Call LLM with retry
                let success = false;
                for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS && !success; attempt++) {
                    try {
                        const response = await completionWithRetry({
                            model: selectedModel,
                            messages: [{ role: "user", content: prompt }],
                            temperature: 0,
                            response_format: { type: "json_object" },
                        }, sessionKeys);

                        // Log AI call
                        const inputTokens = response.usage?.prompt_tokens || 0;
                        const outputTokens = response.usage?.completion_tokens || 0;
                        await supabase.from("ai_calls").insert({
                            job_id: jobId,
                            company_id: companyId,
                            call_type: "ranking_batch",
                            model: response.model || selectedModel,
                            input_tokens: inputTokens,
                            output_tokens: outputTokens,
                            estimated_cost_usd: estimateCost(response.model || selectedModel, inputTokens, outputTokens),
                            latency_ms: 0,
                        });

                        // Parse response
                        const text = response.choices[0]?.message?.content || "";
                        const parsed = extractJsonResponse<LLMResponse>(text);

                        // Strict Validation
                        if (!parsed || !Array.isArray(parsed.results)) {
                            throw new Error("Invalid structure: 'results' array missing");
                        }

                        // Validate each result item
                        for (const r of parsed.results) {
                            if (typeof r.id !== 'number' && typeof r.id !== 'string') {
                                throw new Error(`Invalid result ID: ${r.id}`);
                            }
                            if (typeof r.score !== 'number' || r.score < 0 || r.score > 100) {
                                // Clamp score instead of failing
                                r.score = Math.max(0, Math.min(100, Number(r.score) || 0));
                            }
                        }

                        // Map short IDs back to real UUIDs and normalize data
                        const batchResults = mapResults(parsed.results, idMap, batch);
                        allResults.push(...batchResults);

                        success = true;

                    } catch (e: any) {
                        console.warn(`Batch ${batchIdx + 1} attempt ${attempt} failed:`, e.message?.substring(0, 100));

                        if (e.message?.includes("models exhausted") || e.provider) {
                            rateLimitHit = true;
                            break;
                        }

                        if (attempt < MAX_RETRY_ATTEMPTS) {
                            await sleep(2000 * attempt);
                        }
                    }
                }

                if (success) {
                    // Save batch results immediately
                    const updates = allResults
                        .filter(r => batch.some(c => c.id === r.realId))
                        .map(r => {
                            const candidate = batch.find(c => c.id === r.realId)!;
                            return {
                                id: r.realId,
                                company_id: companyId,
                                title: candidate.title,
                                title_normalized: candidate.title_normalized, // Persist normalized title
                                is_relevant: r.result.is_relevant,
                                role_type: r.result.role_type,
                                relevance_score: r.result.score,
                                rank_within_company: r.result.rank_within_company, // Use LLM rank if available
                                reasoning: r.result.reasoning,
                                rubric_scores: r.result.rubric || {},
                                flags: r.result.flags || [],
                                ranked_at: new Date().toISOString(),
                            };
                        });

                    if (updates.length > 0) {
                        await supabase.from("leads").upsert(updates, { onConflict: "id" });
                        await updateJobProgress(supabase, jobId, 0, updates.length);
                    }

                    // Assign temporary ranks based on current results (for live UI updates)
                    const batchCandidates = new Map(batch.map(c => [c.id, c]));
                    const currentRelevant = allResults.filter(r =>
                        r.result.is_relevant === true ||
                        r.result.score > 0 ||
                        ["decision_maker", "champion"].includes(r.result.role_type)
                    );

                    currentRelevant.sort((a, b) => (b.result.score || 0) - (a.result.score || 0));

                    const tempRankUpdates = currentRelevant.map((r, idx) => {
                        const meta = batchCandidates.get(r.realId);
                        return {
                            id: r.realId,
                            company_id: companyId,
                            title: meta?.title || "Lead",
                            title_normalized: meta?.title_normalized || null, // Persist normalized title
                            rank_within_company: idx + 1,
                        };
                    });

                    if (tempRankUpdates.length > 0) {
                        try {
                            await supabase.from("leads").upsert(tempRankUpdates, { onConflict: "id" });
                        } catch (e) {
                            console.warn("Silent failure on temp rank update (will be fixed in final step)");
                        }
                    }
                }
            }

            // 5. Compute final ranks across ALL results from all batches
            const relevantResults = allResults.filter(r =>
                r.result.is_relevant === true ||
                r.result.score > 0 ||
                ["decision_maker", "champion"].includes(r.result.role_type)
            );

            relevantResults.sort((a, b) => (b.result.score || 0) - (a.result.score || 0));

            console.log(`Assigning final ranks to ${relevantResults.length} leads for company ${company.name}`);

            // Create a lookup map for candidate metadata to satisfy NOT NULL constraints during upsert
            const candidateMap = new Map(candidates.map(c => [c.id, c]));

            // Assign ranks and update
            const rankUpdates = relevantResults.map((r, idx) => {
                const meta = candidateMap.get(r.realId);
                return {
                    id: r.realId,
                    company_id: companyId,
                    title: meta?.title || "Lead", // Required by NOT NULL constraint
                    title_normalized: meta?.title_normalized || null, // Persist normalized title
                    rank_within_company: idx + 1,
                };
            });

            if (rankUpdates.length > 0) {
                console.log(`Updating ${rankUpdates.length} leads with ranks 1-${rankUpdates.length}`);
                const { error: rankError } = await supabase.from("leads").upsert(rankUpdates, { onConflict: "id" });
                if (rankError) {
                    console.error("❌ Failed to save final ranks:", rankError);
                } else {
                    console.log(`✅ Final ranks successfully saved to database`);

                    // Trigger Company Scout if enabled
                    if (useCompanyScout !== false) {
                        console.log(`🚀 Triggering Company Scout for ${company.name}`);
                        await tasks.trigger<typeof companyScoutTask>("company-scout", {
                            jobId,
                            companyId,
                            preferredModel: selectedModel,
                            apiKey,
                            geminiApiKey
                        });
                    }
                }
            } else {
                console.log(`⚠️ No candidates qualified for ranking`);
            }

            // 6. Mark company complete
            await updateJobProgress(supabase, jobId, 1, 0);
            await supabase.from("ai_calls").insert({
                job_id: jobId,
                company_id: companyId,
                call_type: "company_completion",
                model: "System",
                input_tokens: 0,
                output_tokens: 0,
                estimated_cost_usd: 0,
                latency_ms: 0,
            });

            // 7. Check if ALL companies are done - if so, mark job as completed
            const { data: jobData } = await supabase
                .from("ranking_jobs")
                .select("total_companies, processed_companies")
                .eq("id", jobId)
                .single();

            if (jobData && jobData.processed_companies >= jobData.total_companies) {
                console.log(`✅ All ${jobData.total_companies} companies processed. Marking job as completed.`);
                await supabase
                    .from("ranking_jobs")
                    .update({
                        status: "completed",
                        completed_at: new Date().toISOString(),
                    })
                    .eq("id", jobId);
            }

            return {
                status: "success",
                companyId,
                leadsRanked: leads.length,
                relevant: relevantResults.length,
            };

        } catch (error: any) {
            console.error(`rank-company failed for ${companyId}:`, error);

            // Update job with error
            await supabase
                .from("ranking_jobs")
                .update({
                    status: "failed",
                    error: error.message?.substring(0, 500),
                })
                .eq("id", jobId);

            throw error;
        }
    },
});
