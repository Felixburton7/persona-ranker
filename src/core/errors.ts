/**
 * Custom Error Types
 * 
 * Typed, actionable errors for better error handling and debugging.
 * Use these instead of generic Error to provide more context.
 */

/**
 * Base application error with additional context.
 */
export class AppError extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(
        message: string,
        code: string = 'INTERNAL_ERROR',
        statusCode: number = 500,
        isOperational: boolean = true
    ) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        // Maintains proper stack trace in V8 engines
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validation errors (e.g., invalid CSV format, missing fields).
 */
export class ValidationError extends AppError {
    public readonly fields?: string[];

    constructor(message: string, fields?: string[]) {
        super(message, 'VALIDATION_ERROR', 400);
        this.fields = fields;
    }
}

/**
 * Not found errors (e.g., lead not found, job not found).
 */
export class NotFoundError extends AppError {
    public readonly resource: string;

    constructor(resource: string, id?: string) {
        const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
        super(message, 'NOT_FOUND', 404);
        this.resource = resource;
    }
}

/**
 * Database errors (Supabase operations).
 */
export class DatabaseError extends AppError {
    public readonly operation: string;

    constructor(operation: string, originalError?: Error) {
        const message = originalError
            ? `Database ${operation} failed: ${originalError.message}`
            : `Database ${operation} failed`;
        super(message, 'DATABASE_ERROR', 500);
        this.operation = operation;
    }
}

/**
 * External API errors (AI providers, scraping, etc.).
 */
export class ExternalApiError extends AppError {
    public readonly provider: string;

    constructor(provider: string, message: string, statusCode: number = 502) {
        super(`${provider} API error: ${message}`, 'EXTERNAL_API_ERROR', statusCode);
        this.provider = provider;
    }
}

/**
 * Rate limit errors.
 */
export class RateLimitError extends AppError {
    public readonly retryAfter?: number;

    constructor(provider: string, retryAfter?: number) {
        super(`Rate limited by ${provider}`, 'RATE_LIMIT', 429);
        this.retryAfter = retryAfter;
    }
}
