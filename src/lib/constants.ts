/**
 * Shared constants and types used across the application.
 * Centralizing these prevents duplication and ensures consistency.
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Saved API key as returned from the settings API.
 * Used in optimization page and upload form.
 */
export interface SavedApiKey {
    id: string;
    provider: string;
    model_name: string;
    display_name?: string;
}

/**
 * Supported model configuration for ranking and optimization.
 */
export interface SupportedModel {
    name: string;
    displayName: string;
    description: string;
    provider: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Supported models for lead ranking and optimization.
 * Used in upload-form.tsx and optimization/page.tsx.
 */
export const SUPPORTED_MODELS: SupportedModel[] = [
    { name: "llama-3.3-70b-versatile", displayName: "Llama 3.3 70B (Versatile)", description: "Balanced - Best for general use", provider: "Meta" },
    { name: "llama-3.1-8b-instant", displayName: "Llama 3.1 8B (Instant)", description: "Fastest - Great for small companies", provider: "Meta" },
    { name: "openai/gpt-oss-120b", displayName: "GPT-OSS 120B", description: "OpenAI Open Source", provider: "OpenAI" },
    { name: "meta-llama/llama-4-maverick-17b-128e-instruct", displayName: "Llama 4 Maverick", description: "Experimental Llama 4", provider: "Meta" },
    { name: "meta-llama/llama-4-scout-17b-16e-instruct", displayName: "Llama 4 Scout", description: "Experimental Llama 4 Scout", provider: "Meta" },
    { name: "qwen/qwen3-32b", displayName: "Qwen 3 32B", description: "Efficient - 32B params", provider: "Alibaba" },
    { name: "moonshotai/kimi-k2-instruct-0905", displayName: "Kimi K2 Instruct", description: "Optimization specialist", provider: "Moonshot" },
    { name: "groq/compound", displayName: "Groq Compound", description: "Groq native", provider: "Groq" },
    { name: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", description: "Google's latest & fastest", provider: "Google" },
    { name: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", description: "Google's most capable", provider: "Google" },
    { name: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", description: "Google's stable model", provider: "Google" },
    { name: "gemini-2.0-flash-lite", displayName: "Gemini 2.0 Flash Lite", description: "Lightweight & Fast", provider: "Google" },
];
