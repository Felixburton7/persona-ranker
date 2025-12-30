export interface OptimizationRun {
    id: string;
    status: "pending" | "running" | "completed" | "failed";
    max_iterations: number;
    iterations_completed: number;
    started_at: string | null;
    completed_at: string | null;
    error_message?: string | null;
    best_prompt?: {
        id: string;
        version: number;
        composite_score: number;
        relevance_f1: number;
        ranking_ndcg_at_3: number;
        prompt_text?: string;
    };
    improvement_history?: Array<{
        iteration: number;
        metrics: {
            precision: number;
            recall: number;
            f1: number;
            ndcgAt3: number;
            composite: number;
        };
        improved: boolean;
        gradient?: {
            summary: string;
            falsePositiveAnalysis: string;
            falseNegativeAnalysis: string;
            rankingMismatchAnalysis: string;
            suggestedImprovements: string[];
            confidenceLevel: string;
        };
    }>;
}

export interface PromptVersion {
    id: string;
    version: number;
    prompt_text: string;
    is_active: boolean;
    composite_score: number | null;
    parent_version_id?: string | null;
}
