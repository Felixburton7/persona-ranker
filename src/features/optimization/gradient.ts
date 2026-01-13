/**
 * Automatic Prompt Optimization - Gradient Generation
 * 
 * Implements "natural language gradients" as described in the APO paper:
 * - Execute prompt on training data
 * - Collect errors (false positives, false negatives, ranking mismatches)
 * - Use LLM to generate text-based critique ("gradient")
 * - Use gradient to guide prompt edits
 * 
 * Reference: https://cameronrwolfe.substack.com/p/automatic-prompt-optimization
 */

import { llm, LLM_MODEL, extractJsonResponse, completionWithRetry } from "../ai/client";
import { EvalLead, Metrics } from "./metrics";

export interface GradientResult {
    summary: string;
    falsePositiveAnalysis: string;
    falseNegativeAnalysis: string;
    rankingMismatchAnalysis: string;
    suggestedImprovements: string[];
    confidenceLevel: "low" | "medium" | "high";
}

export interface PromptEditSuggestion {
    editType: "add_rule" | "modify_rule" | "remove_rule" | "add_example" | "clarify_instruction";
    targetSection: string;
    originalText?: string;
    proposedChange: string;
    rationale: string;
}

/**
 * Generate a "natural language gradient" by analyzing prediction errors.
 * This is the core APO technique - using LLM to critique prompt failures.
 */
export async function generateGradient(
    currentPrompt: string,
    metrics: Metrics,
    sampleErrors: {
        falsePositives: EvalLead[];
        falseNegatives: EvalLead[];
        rankingMismatches: Array<{
            lead: EvalLead;
            predictedRank: number;
            actualRank: number;
        }>;
    }
): Promise<GradientResult> {
    const fpSamples = sampleErrors.falsePositives.slice(0, 5);
    const fnSamples = sampleErrors.falseNegatives.slice(0, 5);
    const rankMismatchSamples = sampleErrors.rankingMismatches.slice(0, 5);

    const gradientPrompt = `# Prompt Optimization: Error Analysis

You are an expert prompt engineer analyzing errors in a lead qualification prompt. Your goal is to identify patterns in the failures and suggest specific improvements.

## Current Prompt Performance
- Precision: ${(metrics.precision * 100).toFixed(1)}%
- Recall: ${(metrics.recall * 100).toFixed(1)}%
- F1 Score: ${(metrics.f1 * 100).toFixed(1)}%
- NDCG@3: ${(metrics.ndcgAt3 * 100).toFixed(1)}%
- Composite: ${(metrics.composite * 100).toFixed(1)}%

## Current Prompt (Truncated for Context)
\`\`\`
${currentPrompt.slice(0, 2000)}${currentPrompt.length > 2000 ? "\n...[truncated]" : ""}
\`\`\`

## False Positives (Predicted Relevant, Actually Irrelevant)
These leads were incorrectly marked as relevant:
${fpSamples.length > 0 ? fpSamples.map(fp => `- ${fp.fullName} | ${fp.title} | ${fp.company} (${fp.employeeRange})`).join("\n") : "None"}

## False Negatives (Predicted Irrelevant, Actually Relevant)
These leads were incorrectly marked as irrelevant:
${fnSamples.length > 0 ? fnSamples.map(fn => `- ${fn.fullName} | ${fn.title} | ${fn.company} (${fn.employeeRange}) - Ground Truth Rank: ${fn.groundTruthRank}`).join("\n") : "None"}

## Ranking Mismatches (Rank order incorrect)
These leads had significant rank differences:
${rankMismatchSamples.length > 0 ?
            rankMismatchSamples.map(rm =>
                `- ${rm.lead.fullName} | ${rm.lead.title} | ${rm.lead.company}: Predicted #${rm.predictedRank}, Actual #${rm.actualRank}`
            ).join("\n")
            : "None"}

## Your Task
Analyze the patterns in these errors and provide a structured critique ("gradient") that can guide prompt improvements.

Return a JSON object:
{
  "summary": "One paragraph summarizing the key issues with the current prompt",
  "falsePositiveAnalysis": "What patterns cause false positives? What rules are too loose?",
  "falseNegativeAnalysis": "What patterns cause false negatives? What rules are too strict?",
  "rankingMismatchAnalysis": "Why is the ranking order wrong? What priority rules are misapplied?",
  "suggestedImprovements": [
    "Specific, actionable improvement 1",
    "Specific, actionable improvement 2",
    "..."
  ],
  "confidenceLevel": "low|medium|high"
}

Focus on:
1. Company size matching (startup vs enterprise rules)
2. Title/role interpretation 
3. Department fit assessment
4. Seniority level appropriateness

Return ONLY JSON. No markdown.`;

    try {
        const response = await completionWithRetry({
            model: LLM_MODEL,
            messages: [{ role: "user", content: gradientPrompt }],
            temperature: 0.3, // Slight creativity for diverse suggestions
            response_format: { type: "json_object" },
        });

        const result = extractJsonResponse<GradientResult>(response.choices[0]?.message?.content || "");
        return result;
    } catch (error) {
        console.error("Gradient generation failed:", error);
        // Return a default gradient on failure
        return {
            summary: "Gradient generation failed. Manual review recommended.",
            falsePositiveAnalysis: "Unable to analyze - gradient generation error",
            falseNegativeAnalysis: "Unable to analyze - gradient generation error",
            rankingMismatchAnalysis: "Unable to analyze - gradient generation error",
            suggestedImprovements: ["Review false positives manually", "Review false negatives manually"],
            confidenceLevel: "low"
        };
    }
}

/**
 * Generate prompt edit suggestions based on the gradient.
 * This is the "backpropagation" step - translating gradient to prompt changes.
 */
export async function generatePromptEdits(
    currentPrompt: string,
    gradient: GradientResult
): Promise<{
    newPrompt: string;
    edits: PromptEditSuggestion[];
    changesSummary: string;
}> {
    const editPrompt = `# Prompt Editor: Apply Gradient to Improve Prompt

You are an expert prompt engineer. Based on the error analysis ("gradient"), apply targeted edits to improve the prompt.

## Current Prompt
\`\`\`
${currentPrompt}
\`\`\`

## Error Analysis (Gradient)
${gradient.summary}

### False Positive Issues
${gradient.falsePositiveAnalysis}

### False Negative Issues
${gradient.falseNegativeAnalysis}

### Ranking Issues
${gradient.rankingMismatchAnalysis}

### Suggested Improvements
${gradient.suggestedImprovements.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Your Task
Edit the prompt to address these issues. Make surgical, targeted changes - don't rewrite everything.

Return a JSON object:
{
  "newPrompt": "The complete updated prompt with all edits applied",
  "edits": [
    {
      "editType": "add_rule|modify_rule|remove_rule|add_example|clarify_instruction",
      "targetSection": "Which section was edited (e.g., 'Scoring Rules', 'Hard Exclusions')",
      "originalText": "The original text that was changed (if applicable)",
      "proposedChange": "The new/modified text",
      "rationale": "Why this change addresses the gradient"
    }
  ],
  "changesSummary": "One paragraph summary of all changes made"
}

Guidelines:
1. Preserve the overall structure and format
2. Keep JSON output format instructions unchanged
3. Make at most 3-5 targeted edits per iteration
4. Each edit should address a specific issue from the gradient
5. Be conservative - small changes that improve specific failure modes

Return ONLY JSON. No markdown.`;

    try {
        const response = await completionWithRetry({
            model: LLM_MODEL,
            messages: [{ role: "user", content: editPrompt }],
            temperature: 0.2,
            response_format: { type: "json_object" },
        });

        const result = extractJsonResponse<{
            newPrompt: string;
            edits: PromptEditSuggestion[];
            changesSummary: string;
        }>(response.choices[0]?.message?.content || "");

        return result;
    } catch (error) {
        console.error("Prompt edit generation failed:", error);
        // Return unchanged prompt on failure
        return {
            newPrompt: currentPrompt,
            edits: [],
            changesSummary: "Edit generation failed - prompt unchanged"
        };
    }
}

/**
 * Monte Carlo sampling: Generate multiple prompt variants and pick the best.
 * This explores the search space more effectively.
 */
export async function generatePromptVariants(
    currentPrompt: string,
    gradient: GradientResult,
    numVariants: number = 3
): Promise<string[]> {
    const variants: string[] = [];

    for (let i = 0; i < numVariants; i++) {
        const variantPrompt = `# Prompt Variant Generator (Variant ${i + 1}/${numVariants})

Generate a variant of this prompt that addresses the identified issues. Each variant should take a slightly different approach.

## Base Prompt
\`\`\`
${currentPrompt}
\`\`\`

## Issues to Address
${gradient.summary}

Key improvements needed:
${gradient.suggestedImprovements.slice(0, 3).map(s => `- ${s}`).join("\n")}

## Instructions for Variant ${i + 1}
${i === 0 ? "Focus on PRECISION: Be stricter about what counts as relevant. Reduce false positives." : ""}
${i === 1 ? "Focus on RECALL: Be more inclusive. Ensure relevant leads aren't missed. Reduce false negatives." : ""}
${i === 2 ? "Focus on RANKING: Improve the relative ordering. Make priority tiers clearer." : ""}

Return ONLY the modified prompt. No JSON, no explanation. Just the prompt text.`;

        try {
            const response = await completionWithRetry({
                model: LLM_MODEL,
                messages: [{ role: "user", content: variantPrompt }],
                temperature: 0.5 + (i * 0.1), // Increasing temperature for diversity
            });

            const variantText = response.choices[0]?.message?.content?.trim() || "";
            if (variantText && variantText.length > 500) { // Sanity check
                variants.push(variantText);
            }
        } catch (error) {
            console.warn(`Variant ${i + 1} generation failed:`, error);
        }
    }

    return variants;
}
