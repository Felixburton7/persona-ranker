/**
 * Companies Service
 * 
 * Abstracts all database operations for companies.
 */

import { supabase } from '@/core/db/client';
import { DatabaseError, NotFoundError } from '@/core/errors';

// =============================================================================
// TYPES
// =============================================================================

export interface Company {
    id: string;
    name: string;
    domain?: string;
    canonical_key: string;
    employee_range?: string;
    size_bucket?: string;
    industry?: string;
    scraped_summary?: string;
}

export interface CompanyInsert {
    name: string;
    domain?: string;
    canonical_key: string;
    employee_range?: string;
    size_bucket?: string;
    industry?: string;
}

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Fetches a company by ID.
 */
export async function getCompanyById(companyId: string): Promise<Company> {
    const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

    if (error) {
        throw new DatabaseError('fetch company', error);
    }

    if (!data) {
        throw new NotFoundError('Company', companyId);
    }

    return data as Company;
}

/**
 * Upserts companies and returns their IDs.
 */
export async function upsertCompanies(
    companies: CompanyInsert[]
): Promise<Map<string, string>> {
    const { data, error } = await supabase
        .from('companies')
        .upsert(companies, { onConflict: 'canonical_key' })
        .select('id, canonical_key');

    if (error) {
        throw new DatabaseError('upsert companies', error);
    }

    return new Map((data ?? []).map(c => [c.canonical_key, c.id]));
}

/**
 * Updates a company's scraped summary.
 */
export async function updateCompanySummary(
    companyId: string,
    summary: string
): Promise<void> {
    const { error } = await supabase
        .from('companies')
        .update({ scraped_summary: summary })
        .eq('id', companyId);

    if (error) {
        throw new DatabaseError('update company summary', error);
    }
}
