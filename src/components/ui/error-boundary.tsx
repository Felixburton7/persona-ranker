"use client";

import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// =============================================================================
// TYPES
// =============================================================================

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Optional fallback UI to show when an error occurs */
    fallback?: ReactNode;
    /** Optional callback when an error is caught */
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    /** Optional title for the error message */
    title?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

// =============================================================================
// ERROR BOUNDARY COMPONENT
// =============================================================================

/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 * 
 * @example
 * <ErrorBoundary title="Failed to load leads">
 *   <LeadsTable />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        this.setState({ errorInfo });

        // Log to console in development
        if (process.env.NODE_ENV !== "production") {
            console.error("[ErrorBoundary] Caught error:", error);
            console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
        }

        // Call optional error callback
        this.props.onError?.(error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div
                    className="p-6 border border-red-200 rounded-lg bg-red-50 space-y-4"
                    role="alert"
                    aria-live="assertive"
                >
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-100 rounded-full">
                            <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <h3 className="font-semibold text-red-800">
                                {this.props.title || "Something went wrong"}
                            </h3>
                            <p className="text-sm text-red-600">
                                {this.state.error?.message || "An unexpected error occurred"}
                            </p>
                        </div>
                    </div>

                    {/* Show component stack in development */}
                    {process.env.NODE_ENV !== "production" && this.state.errorInfo && (
                        <details className="text-xs text-red-500 bg-red-100 p-3 rounded-md">
                            <summary className="cursor-pointer font-medium">
                                Technical Details (Development Only)
                            </summary>
                            <pre className="mt-2 whitespace-pre-wrap overflow-auto max-h-40">
                                {this.state.errorInfo.componentStack}
                            </pre>
                        </details>
                    )}

                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={this.handleReset}
                            className="text-red-700 border-red-300 hover:bg-red-100"
                        >
                            Try Again
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={this.handleReload}
                            className="text-red-700 border-red-300 hover:bg-red-100"
                        >
                            <RefreshCw className="w-3 h-3 mr-1" aria-hidden="true" />
                            Refresh Page
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// =============================================================================
// HOOK FOR FUNCTIONAL COMPONENTS
// =============================================================================

/**
 * Hook to create a simple error state for functional components.
 * For class-based error boundaries, use the ErrorBoundary component.
 */
export function useErrorHandler() {
    const [error, setError] = React.useState<Error | null>(null);

    const resetError = React.useCallback(() => {
        setError(null);
    }, []);

    const handleError = React.useCallback((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
    }, []);

    return { error, resetError, handleError };
}
