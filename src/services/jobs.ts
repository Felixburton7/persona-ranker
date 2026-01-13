/**
 * Jobs Service
 * 
 * Abstracts all database operations for ranking jobs.
 */

import { supabase } from '@/core/db/client';
import { DatabaseError, NotFoundError } from '@/core/errors';
import { RankingJob, JobProgress, JobStatus } from '@/types/jobs';

// Re-export for backward compatibility
export type { RankingJob, JobProgress, JobStatus } from '@/types/jobs';

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Fetches a ranking job by ID.
 */
export async function getJobById(jobId: string): Promise<RankingJob> {
    const { data, error } = await supabase
        .from('ranking_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

    if (error) {
        throw new DatabaseError('fetch job', error);
    }

    if (!data) {
        throw new NotFoundError('Job', jobId);
    }

    return data as RankingJob;
}

/**
 * Gets the progress of a ranking job.
 */
export async function getJobProgress(jobId: string): Promise<JobProgress> {
    const job = await getJobById(jobId);

    return {
        id: job.id,
        status: job.status,
        total_companies: job.total_companies,
        processed_companies: job.processed_companies,
        total_leads: job.total_leads,
        processed_leads: job.processed_leads,
        error: job.error,
        trigger_batch_id: job.trigger_batch_id,
        partial_completion: job.partial_completion,
        skipped_leads_count: job.skipped_leads_count,
        rate_limit_error: job.rate_limit_error,
    };
}


/**
 * Updates a job's status.
 */
export async function updateJobStatus(
    jobId: string,
    status: RankingJob['status'],
    error?: string
): Promise<void> {
    const updates: Partial<RankingJob> = { status };

    if (status === 'completed' || status === 'failed') {
        updates.completed_at = new Date().toISOString();
    }

    if (error) {
        updates.error = error;
    }

    const { error: updateError } = await supabase
        .from('ranking_jobs')
        .update(updates)
        .eq('id', jobId);

    if (updateError) {
        throw new DatabaseError('update job status', updateError);
    }
}

/**
 * Increments the processed leads count for a job.
 */
export async function incrementProcessedLeads(jobId: string, count: number = 1): Promise<void> {
    const { error } = await supabase.rpc('increment_processed_leads', {
        job_id: jobId,
        increment_by: count,
    });

    // If RPC doesn't exist, fall back to manual update
    if (error) {
        const job = await getJobById(jobId);
        await supabase
            .from('ranking_jobs')
            .update({ processed_leads: (job.processed_leads ?? 0) + count })
            .eq('id', jobId);
    }
}
