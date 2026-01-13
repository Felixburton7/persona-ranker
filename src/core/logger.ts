/**
 * Application Logger
 * 
 * Provides structured logging with environment-aware output.
 * In production, only warnings and errors are logged.
 * In development, all levels are logged with helpful formatting.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    [key: string]: unknown;
}

const LOG_COLORS = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
    reset: '\x1b[0m',
};

const LOG_PREFIXES = {
    debug: '🔍',
    info: '✓',
    warn: '⚠',
    error: '✖',
};

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = LOG_PREFIXES[level];
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';

    if (typeof window === 'undefined') {
        // Server-side: use colors
        const color = LOG_COLORS[level];
        const reset = LOG_COLORS.reset;
        return `${color}[${timestamp}] ${prefix} ${message}${contextStr}${reset}`;
    }

    // Client-side: no colors
    return `[${timestamp}] ${prefix} ${message}${contextStr}`;
}

function shouldLog(level: LogLevel): boolean {
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, only log warnings and errors
    if (isProduction && (level === 'debug' || level === 'info')) {
        return false;
    }

    return true;
}

/**
 * Application logger with structured output.
 * 
 * @example
 * logger.info('Processing leads', { count: 15, company: 'Acme' });
 * logger.error('Failed to rank', { error: err.message });
 */
export const logger = {
    /**
     * Debug-level logging. Only shown in development.
     */
    debug(message: string, context?: LogContext): void {
        if (shouldLog('debug')) {
            console.debug(formatMessage('debug', message, context));
        }
    },

    /**
     * Info-level logging. Only shown in development.
     */
    info(message: string, context?: LogContext): void {
        if (shouldLog('info')) {
            console.info(formatMessage('info', message, context));
        }
    },

    /**
     * Warning-level logging. Always shown.
     */
    warn(message: string, context?: LogContext): void {
        if (shouldLog('warn')) {
            console.warn(formatMessage('warn', message, context));
        }
    },

    /**
     * Error-level logging. Always shown.
     */
    error(message: string, context?: LogContext): void {
        if (shouldLog('error')) {
            console.error(formatMessage('error', message, context));
        }
    },

    /**
     * Log a child context (useful for scoped logging).
     */
    child(baseContext: LogContext) {
        return {
            debug: (message: string, context?: LogContext) =>
                logger.debug(message, { ...baseContext, ...context }),
            info: (message: string, context?: LogContext) =>
                logger.info(message, { ...baseContext, ...context }),
            warn: (message: string, context?: LogContext) =>
                logger.warn(message, { ...baseContext, ...context }),
            error: (message: string, context?: LogContext) =>
                logger.error(message, { ...baseContext, ...context }),
        };
    },
};
