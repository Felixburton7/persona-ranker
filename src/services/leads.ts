/**
 * Leads Service
 * 
 * Abstracts all database operations for leads.
 * Keeps data access logic out of components and API routes.
 */

import { supabase } from '@/core/db/client';
import { Lead } from '@/types/leads';
import { DatabaseError, NotFoundError } from '@/core/errors';

// =============================================================================
// TYPES
// =============================================================================

/** Raw lead row from database with joined company data */
interface LeadRow {
    id: string;
    full_name: string;
    first_name: string;
    last_name: string;
    title: string;
    title_normalized?: string;
    company_id: string;
    relevance_score: number;
    rank_within_company: number | null;
    role_type: string;
    is_relevant: boolean;
    reasoning: string;
    rubric_scores?: {
        department_fit: number;
        seniority_fit: number;
        size_fit: number;
    };
    companies?: {
        name: string;
        size_bucket: string;
    };
}

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Fetches leads for a specific job, with company data joined.
 */
export async function getLeadsByJobId(jobId: string): Promise<Lead[]> {
    // First get company IDs associated with this job
    const { data: calls, error: callsError } = await supabase
        .from('ai_calls')
        .select('company_id')
        .eq('job_id', jobId);

    if (callsError) {
        throw new DatabaseError('fetch ai_calls', callsError);
    }

    const companyIds = [...new Set(calls?.map(c => c.company_id) ?? [])];

    if (companyIds.length === 0) {
        return [];
    }

    // Fetch leads with company data
    const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select(`
            *,
            companies (name, size_bucket)
        `)
        .in('company_id', companyIds);

    if (leadsError) {
        throw new DatabaseError('fetch leads', leadsError);
    }

    // Transform to Lead type
    return (leads ?? []).map((row: LeadRow) => ({
        id: row.id,
        full_name: row.full_name,
        title: row.title,
        title_normalized: row.title_normalized,
        company_name: row.companies?.name ?? '',
        company_size: row.companies?.size_bucket ?? '',
        relevance_score: row.relevance_score ?? 0,
        rank_within_company: row.rank_within_company,
        role_type: row.role_type ?? '',
        is_relevant: row.is_relevant ?? false,
        reasoning: row.reasoning ?? '',
    }));
}

/**
 * Fetches a single lead by ID.
 */
export async function getLeadById(leadId: string): Promise<Lead> {
    const { data, error } = await supabase
        .from('leads')
        .select(`
            *,
            companies (name, size_bucket)
        `)
        .eq('id', leadId)
        .single();

    if (error) {
        throw new DatabaseError('fetch lead', error);
    }

    if (!data) {
        throw new NotFoundError('Lead', leadId);
    }

    const row = data as LeadRow;
    return {
        id: row.id,
        full_name: row.full_name,
        title: row.title,
        title_normalized: row.title_normalized,
        company_name: row.companies?.name ?? '',
        company_size: row.companies?.size_bucket ?? '',
        relevance_score: row.relevance_score ?? 0,
        rank_within_company: row.rank_within_company,
        role_type: row.role_type ?? '',
        is_relevant: row.is_relevant ?? false,
        reasoning: row.reasoning ?? '',
    };
}

/**
 * Updates a lead's ranking data.
 */
export async function updateLeadRanking(
    leadId: string,
    data: {
        relevance_score: number;
        rank_within_company: number | null;
        role_type: string;
        is_relevant: boolean;
        reasoning: string;
    }
): Promise<void> {
    const { error } = await supabase
        .from('leads')
        .update(data)
        .eq('id', leadId);

    if (error) {
        throw new DatabaseError('update lead ranking', error);
    }
}

/**
 * Sorts leads by rank and score (ranked leads first, then by score).
 */
export function sortLeads(leads: Lead[]): Lead[] {
    return [...leads].sort((a, b) => {
        const aHasRank = a.rank_within_company != null && a.rank_within_company >= 1;
        const bHasRank = b.rank_within_company != null && b.rank_within_company >= 1;

        // Ranked leads come first
        if (aHasRank && !bHasRank) return -1;
        if (!aHasRank && bHasRank) return 1;

        // Both ranked: sort by rank
        if (aHasRank && bHasRank) {
            if (a.rank_within_company !== b.rank_within_company) {
                return a.rank_within_company! - b.rank_within_company!;
            }
        }

        // Then by score (descending)
        return (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
    });
}
