/**
 * Optimization Types
 * 
 * Types related to prompt optimization runs.
 */

/**
 * Optimization run status.
 */
export type OptimizationStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Metrics from an optimization iteration.
 */
export interface OptimizationMetrics {
    precision: number;
    recall: number;
    f1: number;
    ndcgAt3: number;
    composite: number;
}

/**
 * Gradient analysis from optimization.
 */
export interface OptimizationGradient {
    summary: string;
    falsePositiveAnalysis: string;
    falseNegativeAnalysis: string;
    rankingMismatchAnalysis: string;
    suggestedImprovements: string[];
    confidenceLevel: string;
}

/**
 * Single iteration in optimization history.
 */
export interface OptimizationIteration {
    iteration: number;
    metrics: OptimizationMetrics;
    improved: boolean;
    gradient?: OptimizationGradient;
}

/**
 * Best prompt result from optimization.
 */
export interface BestPrompt {
    id: string;
    version: number;
    composite_score: number;
    relevance_f1: number;
    ranking_ndcg_at_3: number;
    prompt_text?: string;
}

/**
 * Full optimization run record.
 */
export interface OptimizationRun {
    id: string;
    status: OptimizationStatus;
    max_iterations: number;
    iterations_completed: number;
    started_at: string | null;
    completed_at: string | null;
    error_message?: string | null;
    best_prompt?: BestPrompt;
    improvement_history?: OptimizationIteration[];
}

/**
 * Prompt version record.
 */
export interface PromptVersion {
    id: string;
    version: number;
    prompt_text: string;
    is_active: boolean;
    composite_score: number | null;
    parent_version_id?: string | null;
}
