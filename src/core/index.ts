/**
 * Core Module Index
 * 
 * Re-exports all core utilities and infrastructure for convenient imports.
 * 
 * @example
 * import { logger, supabase, AppError, success } from '@/core';
 */

// Database client
export { supabase, createServerClient } from './db/client';

// Error types
export {
    AppError,
    ValidationError,
    NotFoundError,
    DatabaseError,
    ExternalApiError,
    RateLimitError,
} from './errors';

// API utilities
export { success, error, withErrorHandler } from './api-response';

// Logger
export { logger } from './logger';

// Constants
export * from './constants';
