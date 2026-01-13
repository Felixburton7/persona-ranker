/**
 * Ranking Types
 * 
 * Types related to the AI ranking process.
 */

import { RubricScores } from './leads';

/**
 * Role type returned by the LLM.
 */
export type LLMRoleType = 'decision_maker' | 'champion' | 'irrelevant';

/**
 * Single lead result from the LLM.
 */
export interface LLMResult {
    id: number;  // Short ID (1, 2, 3...)
    is_relevant: boolean;
    role_type: LLMRoleType;
    score: number;
    rank_within_company: number | null;
    rubric: RubricScores;
    flags: string[];
    reasoning: string;
}

/**
 * Full response from the ranking LLM.
 */
export interface LLMResponse {
    results: LLMResult[];
}

/**
 * Mapped result with real UUID.
 */
export interface MappedResult {
    realId: string;
    result: LLMResult;
}
