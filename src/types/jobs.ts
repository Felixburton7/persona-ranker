/**
 * Job Types
 * 
 * Types related to ranking jobs and their progress.
 */

/**
 * Status of a ranking job.
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Job progress data for UI display.
 */
export interface JobProgress {
    id: string;
    status: JobStatus;
    total_companies: number;
    processed_companies: number;
    total_leads: number;
    processed_leads: number;
    error?: string;
    trigger_batch_id?: string;
    partial_completion?: boolean;
    skipped_leads_count?: number;
    rate_limit_error?: string;
}

/**
 * Full ranking job record from database.
 */
export interface RankingJob {
    id: string;
    status: JobStatus;
    total_companies: number;
    total_leads: number;
    processed_companies: number;
    processed_leads: number;
    started_at: string;
    completed_at?: string;
    preferred_model?: string;
    trigger_batch_id?: string;
    error?: string;
    partial_completion?: boolean;
    skipped_leads_count?: number;
    rate_limit_error?: string;
}
