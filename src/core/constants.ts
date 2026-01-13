/**
 * Core Application Constants
 * 
 * Centralized constants to eliminate magic numbers throughout the codebase.
 * All timing, limits, and configuration values should be defined here.
 */

// =============================================================================
// TIMING CONSTANTS
// =============================================================================

/** Base delay multiplier for exponential backoff retries (ms) */
export const RETRY_DELAY_BASE_MS = 2000;

/** Interval for polling job progress updates (ms) */
export const PROGRESS_POLL_INTERVAL_MS = 3000;

/** Debounce delay for realtime updates (ms) */
export const REALTIME_DEBOUNCE_MS = 500;

/** Duration to show "recently updated" highlight (ms) */
export const UPDATE_HIGHLIGHT_DURATION_MS = 2000;

/** Duration to show position change animation (ms) */
export const POSITION_CHANGE_ANIMATION_MS = 600;

/** Delay before resetting updating indicator (ms) */
export const UPDATING_INDICATOR_RESET_MS = 1000;

/** Duration to show save success message (ms) */
export const SAVE_SUCCESS_DURATION_MS = 2000;

// =============================================================================
// BATCH & LIMIT CONSTANTS
// =============================================================================

/** Number of leads to process per LLM batch */
export const LEADS_BATCH_SIZE = 15;

/** Maximum retry attempts for LLM calls */
export const MAX_LLM_RETRY_ATTEMPTS = 3;

/** Default max tokens for LLM responses */
export const DEFAULT_MAX_TOKENS = 8192;

/** Concurrency limit for parallel API calls during optimization */
export const OPTIMIZATION_CONCURRENCY_LIMIT = 8;

/** Maximum polling attempts for waiting on ranking results */
export const MAX_RANKING_POLL_ATTEMPTS = 60;

/** Polling interval while waiting for ranking (seconds) */
export const RANKING_POLL_INTERVAL_SECONDS = 5;

/** Additional wait after ranking detected (seconds) */
export const RANKING_STABILIZATION_WAIT_SECONDS = 10;

// =============================================================================
// UI CONSTANTS
// =============================================================================

/** Default page size for tables */
export const DEFAULT_PAGE_SIZE = 50;

/** Progress percentage threshold for "nearly there" message */
export const NEARLY_THERE_THRESHOLD = 95;

/** Minimum score to be considered relevant */
export const RELEVANCE_SCORE_THRESHOLD = 50;

/** Maximum score possible */
export const MAX_SCORE = 100;

/** Score threshold for decision maker role */
export const DECISION_MAKER_SCORE_THRESHOLD = 90;

// =============================================================================
// API CONSTANTS
// =============================================================================

/** Max duration for upload API route (seconds) */
export const UPLOAD_API_MAX_DURATION = 60;

/** Max duration for optimization task (seconds) */
export const OPTIMIZATION_TASK_MAX_DURATION = 1800;

/** Max duration for ranking task (seconds) */
export const RANKING_TASK_MAX_DURATION = 300;

/** Max duration for scout task (seconds) */
export const SCOUT_TASK_MAX_DURATION = 600;

// =============================================================================
// CONVERGENCE THRESHOLDS
// =============================================================================

/** F1 score threshold for prompt optimization convergence */
export const OPTIMIZATION_F1_THRESHOLD = 0.85;

/** NDCG@3 threshold for prompt optimization convergence */
export const OPTIMIZATION_NDCG_THRESHOLD = 0.80;

// =============================================================================
// ERROR HANDLING
// =============================================================================

/** Maximum length for error messages stored in database */
export const MAX_ERROR_MESSAGE_LENGTH = 500;

/** HTTP status codes that trigger retry */
export const RETRYABLE_STATUS_CODES = [429, 413, 404, 400, 401, 503];
