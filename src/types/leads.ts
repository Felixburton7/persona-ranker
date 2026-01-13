/**
 * Lead Types
 * 
 * Centralized type definitions for lead-related data structures.
 */

/**
 * Valid role types assigned during ranking.
 */
export type RoleType =
    | 'decision_maker'
    | 'champion'
    | 'influencer'
    | 'gatekeeper'
    | 'user'
    | 'irrelevant'
    | 'skipped';

/**
 * Rubric scores from AI ranking (1-5 scale).
 */
export interface RubricScores {
    department_fit: number;
    seniority_fit: number;
    size_fit: number;
}

/**
 * Lead data as displayed in the UI.
 * Includes joined company data.
 */
export interface Lead {
    id: string;
    full_name: string;
    title: string;
    title_normalized?: string;
    company_name: string;
    company_size: string;
    relevance_score: number;
    rank_within_company: number | null;
    role_type: RoleType | string;
    is_relevant: boolean;
    reasoning: string;
    rubric_scores?: RubricScores;
}

/**
 * Lead data as stored in the database (before joining).
 */
export interface LeadRow {
    id: string;
    company_id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    title: string;
    title_normalized?: string;
    linkedin_url?: string;
    relevance_score?: number;
    rank_within_company?: number | null;
    role_type?: string;
    is_relevant?: boolean;
    reasoning?: string;
    rubric_scores?: RubricScores;
    raw_json?: Record<string, unknown>;
}

/**
 * Lead insert payload (for creating new leads).
 */
export interface LeadInsert {
    company_id: string;
    first_name: string;
    last_name: string;
    title: string;
    linkedin_url?: string;
    raw_json?: Record<string, unknown>;
}

