/**
 * Standardized API Response Utilities
 * 
 * Provides consistent response patterns for all API routes.
 * Ensures uniform error handling and response structure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AppError } from './errors';

// =============================================================================
// RESPONSE TYPES
// =============================================================================

interface SuccessResponse<T> {
    success: true;
    data: T;
}

interface ErrorResponse {
    success: false;
    error: {
        message: string;
        code: string;
        fields?: string[];
    };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Creates a successful JSON response.
 */
export function success<T>(data: T, status: number = 200): NextResponse<SuccessResponse<T>> {
    return NextResponse.json({ success: true, data }, { status });
}

/**
 * Creates an error JSON response from an Error or AppError.
 */
export function error(err: Error | AppError, fallbackStatus: number = 500): NextResponse<ErrorResponse> {
    const isAppError = err instanceof AppError;

    return NextResponse.json(
        {
            success: false,
            error: {
                message: err.message,
                code: isAppError ? err.code : 'INTERNAL_ERROR',
                fields: 'fields' in err ? (err as { fields?: string[] }).fields : undefined,
            },
        },
        { status: isAppError ? err.statusCode : fallbackStatus }
    );
}

/**
 * Wraps an async route handler with consistent error handling.
 * Catches errors and returns standardized error responses.
 * 
 * @example
 * export const POST = withErrorHandler(async (req) => {
 *   const data = await doSomething();
 *   return success(data);
 * });
 */
export function withErrorHandler<T>(
    handler: (req: NextRequest) => Promise<NextResponse<T>>
) {
    return async (req: NextRequest): Promise<NextResponse<T | ErrorResponse>> => {
        try {
            return await handler(req);
        } catch (err) {
            const e = err as Error;
            // Log unexpected errors
            if (!(e instanceof AppError) || !e.isOperational) {
                console.error('[API Error]', e);
            }
            return error(e);
        }
    };
}
