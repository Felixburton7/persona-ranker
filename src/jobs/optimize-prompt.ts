/**
 * Automatic Prompt Optimization Task
 * 
 * Implements the APO (Automatic Prompt Optimization) / ProTeGi algorithm:
 * 1. Evaluate current prompt on eval set
 * 2. Generate "natural language gradient" from errors
 * 3. Apply gradient to generate improved prompt
 * 4. Re-evaluate and iterate
 * 
 * Reference: https://cameronrwolfe.substack.com/p/automatic-prompt-optimization
 */

import { task, metadata } from "@trigger.dev/sdk/v3";
import { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/core/db/client";
import { llm, LLM_MODEL, extractJsonResponse, completionWithRetry, estimateCost, RankingResponse } from "@/features/ai/client";
import { buildRankingPrompt } from "@/features/ranking/prompt";
import { prefilterLead } from "@/features/ranking/prefilter";
import { normalizeTitle } from "@/features/ingestion/normalization/title";
import { computeMetrics, EvalLead, Metrics } from "@/features/optimization/metrics";
import { generateGradient, generatePromptEdits, GradientResult } from "@/features/optimization/gradient";
import { parseEvalSet, loadEvalSetFromFile, groupByCompany, findRankingMismatches, EvalSetData } from "@/features/optimization/eval-set";
import { normalizeSizeBucket } from "@/features/ingestion/normalization/size";

interface OptimizePromptPayload {
    runId: string;
    maxIterations?: number;
    evalSetPath?: string; // Optional: path to eval CSV
    sessionKey: string; // Required for multi-tenancy
}

interface IterationResult {
    iteration: number;
    promptVersionId: string;
    metrics: Metrics;
    gradient: GradientResult | null;
    improved: boolean;
}

export const optimizePromptTask = task({
    id: "optimize-prompt",
    maxDuration: 1800, // 30 minutes max
    retry: {
        maxAttempts: 1, // Don't retry - optimization is expensive
    },

    run: async (payload: OptimizePromptPayload) => {
        const supabase = createServerClient();
        if (!supabase) throw new Error("Supabase credentials missing");

        const { runId, maxIterations = 5, evalSetPath, sessionKey } = payload;

        if (!sessionKey) throw new Error("Session key is required for optimization");

        try {
            // 1. Update run status to running
            await supabase
                .from("optimization_runs")
                .update({
                    status: "running",
                    started_at: new Date().toISOString()
                })
                .eq("id", runId);

            // 2. Load evaluation set
            metadata.set("phase", "loading_eval_set");

            await supabase.from("ai_calls").insert({
                call_type: "eval_progress",
                model: "Initializing engine: This typically takes 5-10 minutes...",
                input_tokens: 0,
                output_tokens: 0,
                estimated_cost_usd: 0
            });

            const evalData = loadEvalSetFromFile(evalSetPath);
            metadata.set("evalLeads", evalData.stats.totalLeads);
            metadata.set("evalCompanies", evalData.stats.uniqueCompanies);

            await supabase.from("ai_calls").insert({
                call_type: "eval_progress",
                model: `Loaded ${evalData.stats.totalLeads} leads across ${evalData.stats.uniqueCompanies} companies. Starting v1 evaluation...`,
                input_tokens: 0,
                output_tokens: 0,
                estimated_cost_usd: 0
            });

            // 3. Get or create initial prompt version - SCOPED TO SESSION
            // IMPORTANT: We start with the user's actual prompt from the database (if it exists for this session)
            let { data: activePrompt } = await supabase
                .from("prompt_versions")
                .select("*")
                .eq("is_active", true)
                .eq("session_key", sessionKey) // Scoped
                .single();

            if (!activePrompt) {
                // Fallback: Create initial version from codebase template if no prompt exists for this session
                console.log(`No active prompt found for session ${sessionKey}, creating initial version from codebase template`);
                await supabase.from("ai_calls").insert({
                    call_type: "eval_progress",
                    model: "No existing prompt found. Configuring new optimization session...",
                    input_tokens: 0,
                    output_tokens: 0,
                    estimated_cost_usd: 0
                });

                const { prompt: initialPrompt } = buildRankingPrompt(
                    { name: "PLACEHOLDER", size_bucket: "smb", employee_range: "51-200" },
                    [{ id: "test", full_name: "Test User", title: "VP Sales" }]
                );

                const { data: created, error } = await supabase
                    .from("prompt_versions")
                    .insert({
                        version: 1,
                        prompt_text: initialPrompt,
                        is_active: true,
                        session_key: sessionKey // Assign to session
                    })
                    .select()
                    .single();

                if (error) throw error;
                activePrompt = created;
            } else {
                // Log which prompt we're starting with
                console.log(`Starting optimization with existing prompt version ${activePrompt.version} (Session: ${sessionKey})`);
                await supabase.from("ai_calls").insert({
                    call_type: "eval_progress",
                    model: `Starting optimization with your current prompt (version ${activePrompt.version}). This will be evaluated and improved across ${maxIterations} iterations.`,
                    input_tokens: 0,
                    output_tokens: 0,
                    estimated_cost_usd: 0
                });
            }

            let currentPrompt = activePrompt.prompt_text;
            let currentPromptId = activePrompt.id;
            let currentVersion = activePrompt.version;
            let bestMetrics: Metrics | null = null;
            let bestPromptId = currentPromptId;

            const history: IterationResult[] = [];

            // 4. Optimization loop
            for (let iteration = 0; iteration < maxIterations; iteration++) {
                metadata.set("phase", `iteration_${iteration + 1}_evaluate`);
                metadata.set("iteration", iteration + 1);

                // 4a. Evaluate current prompt on eval set
                // metrics now includes predictions which we can use for gradient generation
                const { metrics, predictions } = await evaluatePromptOnEvalSet(
                    supabase,
                    runId,
                    currentPrompt,
                    evalData,
                    `iteration_${iteration + 1}`
                );

                // 4b. Store metrics in prompt_versions
                await supabase
                    .from("prompt_versions")
                    .update({
                        relevance_precision: metrics.precision,
                        relevance_recall: metrics.recall,
                        relevance_f1: metrics.f1,
                        ranking_ndcg_at_3: metrics.ndcgAt3,
                        composite_score: metrics.composite,
                    })
                    .eq("id", currentPromptId);

                // Update best if improved
                const improved = !bestMetrics || metrics.composite > bestMetrics.composite;
                if (improved) {
                    bestMetrics = metrics;
                    bestPromptId = currentPromptId;
                }

                // Check for convergence (F1 > 0.85 and NDCG > 0.80)
                if (metrics.f1 > 0.85 && metrics.ndcgAt3 > 0.80) {
                    metadata.set("phase", "converged");
                    history.push({
                        iteration: iteration + 1,
                        promptVersionId: currentPromptId,
                        metrics,
                        gradient: null,
                        improved
                    });
                    break;
                }

                // 4c. Generate gradient from errors
                metadata.set("phase", `iteration_${iteration + 1}_gradient`);
                await supabase.from("ai_calls").insert({
                    call_type: "eval_progress",
                    model: `Analyzing v${iteration + 1} results: Identifying why some leads were missed...`,
                    input_tokens: 0,
                    output_tokens: 0,
                    estimated_cost_usd: 0
                });

                // Find ranking mismatches for richer gradient - USING SAVED PREDICTIONS (Cost Efficient)
                const rankingMismatches = findRankingMismatches(predictions, evalData.leads);

                const gradient = await generateGradient(
                    currentPrompt,
                    metrics,
                    {
                        falsePositives: metrics.falsePositives,
                        falseNegatives: metrics.falseNegatives,
                        rankingMismatches
                    }
                );

                // Log gradient AI call
                await supabase.from("ai_calls").insert({
                    call_type: "gradient",
                    model: LLM_MODEL,
                    input_tokens: 0, // Estimate
                    output_tokens: 0,
                    estimated_cost_usd: 0.001,
                });

                // 4d. Apply gradient to generate new prompt
                metadata.set("phase", `iteration_${iteration + 1}_edit`);
                await supabase.from("ai_calls").insert({
                    call_type: "eval_progress",
                    model: `Improving v${iteration + 1} → v${iteration + 2}: Rewriting instructions for edge cases...`,
                    input_tokens: 0,
                    output_tokens: 0,
                    estimated_cost_usd: 0
                });
                const editResult = await generatePromptEdits(currentPrompt, gradient);

                // Skip if no meaningful changes
                if (editResult.newPrompt === currentPrompt || editResult.edits.length === 0) {
                    history.push({
                        iteration: iteration + 1,
                        promptVersionId: currentPromptId,
                        metrics,
                        gradient,
                        improved
                    });
                    continue;
                }

                // 4e. Create new prompt version
                currentVersion++;
                const { data: newPromptVersion, error: insertError } = await supabase
                    .from("prompt_versions")
                    .insert({
                        version: currentVersion,
                        prompt_text: editResult.newPrompt,
                        is_active: false,
                        parent_version_id: currentPromptId,
                        gradient_summary: editResult.changesSummary,
                        session_key: sessionKey // Scope to session
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;

                history.push({
                    iteration: iteration + 1,
                    promptVersionId: currentPromptId,
                    metrics,
                    gradient,
                    improved
                });

                // Move to new prompt
                currentPrompt = editResult.newPrompt;
                currentPromptId = newPromptVersion.id;

                // Update optimization run progress
                await supabase
                    .from("optimization_runs")
                    .update({
                        iterations_completed: iteration + 1,
                        improvement_history: history,
                    })
                    .eq("id", runId);
            }

            // 5. Finalize: Set best prompt as active (Scoped to Session)
            await supabase.from("ai_calls").insert({
                call_type: "eval_progress",
                model: "Optimization complete! Promoting the best performing version...",
                input_tokens: 0,
                output_tokens: 0,
                estimated_cost_usd: 0
            });

            // Deactivate all prompts for this session
            await supabase
                .from("prompt_versions")
                .update({ is_active: false })
                .eq("session_key", sessionKey) // IMPORTANT: Scope to session
                .neq("id", bestPromptId);

            // Activate the winner
            await supabase
                .from("prompt_versions")
                .update({ is_active: true })
                .eq("id", bestPromptId);

            // 6. Complete the run
            await supabase
                .from("optimization_runs")
                .update({
                    status: "completed",
                    completed_at: new Date().toISOString(),
                    best_prompt_id: bestPromptId,
                    iterations_completed: history.length,
                    improvement_history: history,
                })
                .eq("id", runId);

            return {
                status: "completed",
                iterationsRun: history.length,
                bestPromptId,
                finalMetrics: bestMetrics,
                history
            };

        } catch (error: any) {
            console.error("Prompt optimization failed:", error);

            // Check if this is a rate limit error
            const isRateLimitError =
                error.status === 429 ||
                error.message?.toLowerCase().includes("rate limit") ||
                error.message?.toLowerCase().includes("all") && error.message?.toLowerCase().includes("models exhausted");

            await supabase
                .from("optimization_runs")
                .update({
                    status: "failed",
                    completed_at: new Date().toISOString(),
                    error_message: isRateLimitError
                        ? "rate_limit_exceeded"
                        : error.message || "Unknown error",
                })
                .eq("id", runId);

            throw error;
        }
    },
});

/**
 * Evaluate a prompt on the evaluation set.
 * Runs the prompt against all eval companies and computes metrics.
 */
async function evaluatePromptOnEvalSet(
    supabase: SupabaseClient,
    runId: string,
    promptTemplate: string,
    evalData: EvalSetData,
    iterationLabel: string
): Promise<{ metrics: Metrics; predictions: Map<string, { is_relevant: boolean; rank: number | null }> }> {
    const predictions = new Map<string, { is_relevant: boolean; rank: number | null }>();
    const companyGroups = Array.from(groupByCompany(evalData.leads).entries());
    const totalCompanies = companyGroups.length;

    // Use a concurrency limit to avoid rate limits
    const CONCURRENCY_LIMIT = 8; // Increased from 5 for better speed
    const results: Array<{ id: string; is_relevant: boolean; rank: number | null }>[] = [];

    metadata.set("totalCompanies", totalCompanies);
    metadata.set("companiesProcessed", 0);

    // Process in chunks to maintain concurrency
    for (let i = 0; i < companyGroups.length; i += CONCURRENCY_LIMIT) {
        const chunk = companyGroups.slice(i, i + CONCURRENCY_LIMIT);

        // Calculate progress percentage
        const progressPercent = Math.round((i / totalCompanies) * 100);

        // Log batch start
        if (i % (CONCURRENCY_LIMIT * 2) === 0) {
            await supabase.from("ai_calls").insert({
                call_type: "eval_progress",
                model: `Evaluating batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1}/${Math.ceil(totalCompanies / CONCURRENCY_LIMIT)} (${progressPercent}%)`,
                input_tokens: 0,
                output_tokens: 0,
                estimated_cost_usd: 0
            });
        }

        await Promise.all(chunk.map(async (companyEntry, index) => {
            const [companyName, companyLeads] = companyEntry;
            // Determine size bucket from employee range
            const employeeRange = companyLeads[0]?.employeeRange || "";
            const sizeBucket = normalizeSizeBucket(employeeRange) || "smb";

            // Build prompt for this company
            const companyContext = {
                name: companyName,
                size_bucket: sizeBucket,
                employee_range: employeeRange,
                industry: null,
            };

            const candidates = companyLeads.map(l => ({
                id: l.id,
                full_name: l.fullName,
                title: l.title,
            }));

            // Create a prompt using the template pattern but with eval data
            const prompt = buildPromptForEval(promptTemplate, companyContext, candidates);

            try {
                const response = await completionWithRetry({
                    model: LLM_MODEL,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0,
                    response_format: { type: "json_object" },
                });

                // Track AI call
                const inputTokens = response.usage?.prompt_tokens || 0;
                const outputTokens = response.usage?.completion_tokens || 0;
                await supabase.from("ai_calls").insert({
                    call_type: "optimization",
                    model: response.model || LLM_MODEL,
                    input_tokens: inputTokens,
                    output_tokens: outputTokens,
                    estimated_cost_usd: estimateCost(response.model || LLM_MODEL, inputTokens, outputTokens),
                });

                const responseText = response.choices[0]?.message?.content || "";
                const parsed = extractJsonResponse<RankingResponse>(responseText);

                // Convert to predictions map
                if (parsed.results) {
                    // Sort by score for ranking
                    const sorted = [...parsed.results]
                        .filter(r => r.is_relevant)
                        .sort((a, b) => b.score - a.score);

                    const companyPredictions: Array<{ id: string; is_relevant: boolean; rank: number | null }> = [];
                    for (const result of parsed.results) {
                        const rank = result.is_relevant
                            ? sorted.findIndex(r => r.id === result.id) + 1
                            : null;

                        companyPredictions.push({
                            id: result.id,
                            is_relevant: result.is_relevant,
                            rank
                        });
                    }
                    results.push(companyPredictions);
                }
            } catch (error: any) {
                console.warn(`Eval failed for company ${companyName}:`, error.message);
                // Don't crash the whole run, just this company
            } finally {
                // Log progress for frontend commentary
                // const processed = i + index + 1;
                // Only log sparingly to avoid DB spam
            }
        }));

        metadata.set("companiesProcessed", Math.min(i + CONCURRENCY_LIMIT, totalCompanies));
    }

    // Flatten results into predictions map
    for (const companyResults of results) {
        for (const res of companyResults) {
            predictions.set(res.id, { is_relevant: res.is_relevant, rank: res.rank });
        }
    }

    const metrics = computeMetrics(predictions, evalData.leads);
    return { metrics, predictions };
}

/**
 * Get predictions without storing - for gradient generation.
 */
// getPredictionsFromEval removed as it's no longer used (merged into evaluatePromptOnEvalSet)

/**
 * Build a prompt for evaluation using the template pattern.
 * This uses the same buildRankingPrompt function to ensure consistency.
 */
function buildPromptForEval(
    template: string,
    company: { name: string; size_bucket: string; employee_range: string; industry?: string | null },
    candidates: Array<{ id: string; full_name: string; title: string }>
): string {
    // 1. Construct Company Context Section
    const companyContextSection = [
        `## Company Context`,
        `- **Company:** ${company.name}`,
        `- **Size:** ${company.size_bucket ? company.size_bucket.toUpperCase() : "UNKNOWN"} (${company.employee_range})`,
        `- **Industry:** ${company.industry || "Unknown"}`
    ].join("\n");

    // 2. Construct Candidates Section
    const candidateList = candidates
        .map((c, i) => `${i + 1}. ID: ${c.id} | ${c.full_name} | ${c.title}`)
        .join("\n");
    const candidatesSection = `## Candidates to Rank\n${candidateList}`;

    // 3. Replace in Template
    // We expect the template to have sections starting with ## Company Context and ## Candidates to Rank
    // We'll use regex to replace specific sections.

    let newPrompt = template;

    // Replace Company Context
    // Matches "## Company Context" followed by anything until the next "## " or end of string
    newPrompt = newPrompt.replace(
        /## Company Context[\s\S]*?(?=\n## |$)/,
        companyContextSection
    );

    // Replace Candidates
    newPrompt = newPrompt.replace(
        /## Candidates to Rank[\s\S]*?(?=\n## |$)/,
        candidatesSection
    );

    // Fallback: If replacement didn't happen (maybe template structure changed),
    // use the standard builder as a failsafe, but this shouldn't happen if the AI maintains structure.
    if (newPrompt === template && !template.includes(company.name)) {
        console.warn("Template sections not found for replacement, falling back to default builder.");
        const { prompt } = buildRankingPrompt({
            ...company,
            industry: company.industry ?? undefined
        }, candidates);
        return prompt;
    }

    return newPrompt;
}
