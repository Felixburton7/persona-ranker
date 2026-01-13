/**
 * AI Client for Lead Ranking
 * 
 * Supports both Groq and Google Gemini providers via OpenAI SDK.
 * Provider is selected based on model name prefix:
 * - "gemini-*" → Google Gemini (OpenAI-compatible endpoint)
 * - Everything else → Groq
 * 
 * STRICT MODE: If user selects a Gemini model, fallback ONLY uses other Gemini models.
 * No cross-provider fallback to prevent unexpected behavior.
 */

import OpenAI from "openai";
import { getApiKeyForModel } from "@/services/api-keys";
import { SUPPORTED_MODELS } from "@/config/constants";
import { logger } from "@/core/logger";
import {
  DEFAULT_MAX_TOKENS,
  RETRYABLE_STATUS_CODES,
} from "@/core/constants";

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Default Groq API key (from environment or placeholder for build) */
const GROQ_DEFAULT_KEY = process.env.GROQ_API_KEY || "dummy_key_for_build";

/** Default Gemini API key (from environment or hardcoded fallback) */
const GEMINI_DEFAULT_KEY = process.env.GEMINI_API_KEY || "";

/** Provider base URLs */
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

/** Default model for optimization and general use */
export const LLM_MODEL = "gemini-2.5-flash";

// ============================================================================
// MODEL LISTS
// ============================================================================

/**
 * Groq models - ordered by capability
 * Derived from shared constants
 */
const GROQ_MODELS = SUPPORTED_MODELS
  .filter(m => m.provider !== "Google")
  .map(m => m.name);

/**
 * Gemini models - for OpenAI-compatible endpoint
 * Derived from shared constants
 */
const GEMINI_MODELS = SUPPORTED_MODELS
  .filter(m => m.provider === "Google")
  .map(m => m.name);

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

interface ProviderConfig {
  apiKey: string;
  baseURL: string;
}

interface SessionKeys {
  groq?: string;
  gemini?: string;
}

/**
 * Determines if a model is a Gemini model
 */
function isGeminiModel(model: string): boolean {
  return model.startsWith("gemini");
}

/**
 * Gets the provider configuration for a given model.
 * Priority: session key > database key > environment key > default
 */
async function getProviderConfig(model: string, keys: SessionKeys): Promise<ProviderConfig> {
  const isGemini = isGeminiModel(model);

  // Try session key first
  let apiKey = isGemini ? keys.gemini : keys.groq;

  // Try database if no session key
  if (!apiKey) {
    const dbResult = await getApiKeyForModel(model);
    if (dbResult) {
      apiKey = dbResult.api_key;
    }
  }

  // Fall back to defaults
  if (isGemini) {
    return {
      apiKey: apiKey || GEMINI_DEFAULT_KEY,
      baseURL: GEMINI_BASE_URL,
    };
  }

  return {
    apiKey: apiKey || GROQ_DEFAULT_KEY,
    baseURL: GROQ_BASE_URL,
  };
}

// ============================================================================
// MAIN COMPLETION FUNCTION
// ============================================================================

/**
 * Makes a chat completion request with automatic fallback.
 * 
 * STRICT MODE: If user requests a Gemini model, only Gemini models are used for fallback.
 * This prevents silently switching to Groq when user explicitly chose Gemini.
 * 
 * @param params - OpenAI chat completion parameters
 * @param sessionKeys - Optional API keys for this session (string = legacy Groq key)
 */
export async function completionWithRetry(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  sessionKeys?: string | SessionKeys
): Promise<OpenAI.Chat.Completions.ChatCompletion> {

  // Determine provider mode
  const isStrictGeminiMode = isGeminiModel(params.model);

  // Build fallback list based on mode
  const fallbackList = isStrictGeminiMode ? GEMINI_MODELS : [...GROQ_MODELS, ...GEMINI_MODELS];

  // Create unique model list with requested model first
  const models = [params.model, ...fallbackList.filter(m => m !== params.model)];
  const uniqueModels = Array.from(new Set(models));


  // Normalize session keys
  const keys: SessionKeys = typeof sessionKeys === 'string'
    ? { groq: sessionKeys } // Legacy: string = Groq key
    : (sessionKeys || {});

  let lastError: Error & { status?: number; message?: string } | null = null;

  // Try each model in order
  for (let i = 0; i < uniqueModels.length; i++) {
    const model = uniqueModels[i];
    if (!model) continue;

    try {
      if (i > 0) {
        logger.info(`Fallback attempt`, { attempt: i, total: uniqueModels.length - 1, model });
      }

      const config = await getProviderConfig(model, keys);

      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });

      return await client.chat.completions.create({
        max_tokens: DEFAULT_MAX_TOKENS,
        ...params,
        model,
      });

    } catch (error: unknown) {
      const err = error as Error & { status?: number; message?: string };
      lastError = err;

      // Retryable errors - continue to next model
      const isRetryable = RETRYABLE_STATUS_CODES.includes(err.status || 0);

      if (isRetryable) {
        logger.warn(`Model failed`, { model, status: err.status, error: err.message?.substring(0, 100) });
        continue;
      }

      // Non-retryable error - throw immediately
      throw error;
    }
  }

  // All models exhausted - create detailed error message
  const provider = isStrictGeminiMode ? "Gemini" : "Groq";
  let errorMessage: string;

  const status = lastError?.status;
  const errorMsg = lastError?.message;

  if (isStrictGeminiMode) {
    // Gemini-specific error messages
    switch (status) {
      case 429:
        errorMessage = `Gemini Rate Limit: Quota exceeded. Check billing at https://ai.google.dev/usage`;
        break;
      case 401:
        errorMessage = `Gemini Auth Failed: Invalid API key. Check key at https://aistudio.google.com/app/apikey`;
        break;
      case 404:
        errorMessage = `Gemini Model Not Found: '${params.model}' unavailable. Try gemini-1.5-flash or gemini-1.5-pro`;
        break;
      default:
        errorMessage = `Gemini Error: All ${uniqueModels.length} models failed. Last: ${errorMsg?.substring(0, 150)}`;
    }
  } else {
    errorMessage = `All ${uniqueModels.length} models exhausted. Last error: ${errorMsg?.substring(0, 150)}`;
  }

  logger.error(`All models exhausted`, { errorMessage, provider, modelsAttempted: uniqueModels.length });

  // Create a structured error object
  const error = new Error(errorMessage) as Error & { status: number; provider: string; modelsAttempted: string[] };
  error.status = status || 429;
  error.provider = provider;
  error.modelsAttempted = uniqueModels;
  throw error;
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================================================

/** Legacy LLM client - use completionWithRetry instead */
export const llm = new OpenAI({
  apiKey: GROQ_DEFAULT_KEY,
  baseURL: GROQ_BASE_URL,
});

/** Legacy model selector - always returns default model */
export function selectModelForCompany(_leadCount: number): string {
  return LLM_MODEL;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface RankingResponse {
  results: LeadScore[];
}

export interface LeadScore {
  id: string;
  is_relevant: boolean;
  role_type: "decision_maker" | "champion" | "irrelevant";
  rank_within_company: number | null;
  score: number;
  rubric: {
    department_fit: number;
    seniority_fit: number;
    size_fit: number;
  };
  reasoning: string;
  flags: string[];
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Extracts JSON from LLM response text.
 * Handles markdown code blocks, wrapped objects, and bare arrays.
 * Now improved to handle thinking tags and truncated JSON.
 */
export function extractJsonResponse<T>(text: string): T {
  // 1. Clean thinking tags if present (e.g. from Gemini Thinking models)
  const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // 2. Try direct parse
  try {
    return JSON.parse(cleanText);
  } catch { /* continue */ }

  // 3. Try finding JSON object/array via regex (complete)
  const objectMatch = cleanText.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch { /* continue */ }
  }

  const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return { results: parsed } as unknown as T;
      }
    } catch { /* continue */ }
  }

  // 4. Handle truncated JSON (very common in optimization tasks)
  // Find the start of the JSON
  const startIndex = cleanText.indexOf('{');
  if (startIndex !== -1) {
    let truncated = cleanText.slice(startIndex);

    // Strategy A: Aggressive Array Repair (Discard incomplete last item)
    // Most valuable for "results": [...] lists where we can afford to lose the last item
    // but cannot afford to crash the whole batch.
    const resultsMarker = /"results"\s*:\s*\[/;
    if (resultsMarker.test(truncated)) {
      // Find the last completely closed object within the array
      const lastObjectEnd = truncated.lastIndexOf('},');
      const arrayStart = truncated.indexOf('[');

      // If we found a closed object AND it's after the array started
      if (lastObjectEnd > arrayStart) {
        const healed = truncated.slice(0, lastObjectEnd + 1) + ']}';
        try {
          return JSON.parse(healed);
        } catch { /* continue to Strategy B */ }
      }
    }

    // Strategy B: Basic Closure Repair (Try to close current item)
    // Attempt basic repair: close open strings and braces
    let repaired = truncated;

    // Remove text that shouldn't be there (e.g. trailing "..." or "etc")
    repaired = repaired.replace(/\.\.\.$/, "").trim();

    // If it ends with a backslash (truncated escape), remove it to avoid escaping our closing quote
    if (repaired.endsWith("\\")) {
      repaired = repaired.slice(0, -1);
    }

    // If it ends in the middle of a string (no closing quote for the last value)
    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      repaired += '"';
    }

    // Remove trailing comma if present (common in truncation)
    // Also remove trailing "key": or "key" if it stops there
    repaired = repaired.trim();
    if (repaired.endsWith(',')) {
      repaired = repaired.slice(0, -1);
    }

    // Add closing braces/brackets until it parses
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    for (let i = 0; i < (openBraces - closeBraces); i++) {
      repaired += '}';
    }

    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    for (let i = 0; i < (openBrackets - closeBrackets); i++) {
      repaired += ']';
    }

    try {
      return JSON.parse(repaired);
    } catch { /* continue */ }
  }

  // Final check: sometimes it's valid JSON wrapped in quotes?
  if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
    try {
      return JSON.parse(JSON.parse(cleanText)); // Double parse
    } catch { /* continue */ }
  }

  throw new Error(`Failed to parse JSON (length ${cleanText.length}): ${cleanText.slice(0, 500)}...`);
}

/**
 * Estimates cost for a completion (for tracking only, not authoritative)
 */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const PRICING: Record<string, { input: number; output: number }> = {
    // Groq models
    "llama-3.3-70b-versatile": { input: 0.00059, output: 0.00079 },
    "llama-3.1-8b-instant": { input: 0.00005, output: 0.00008 },
    "openai/gpt-oss-120b": { input: 0.00015, output: 0.00060 },
    "qwen/qwen3-32b": { input: 0.00029, output: 0.00059 },
    "meta-llama/llama-4-scout-17b-16e-instruct": { input: 0.00011, output: 0.00034 },
    "meta-llama/llama-4-maverick-17b-128e-instruct": { input: 0.00011, output: 0.00034 },
    "moonshotai/kimi-k2-instruct-0905": { input: 0.0003, output: 0.0006 },
    "groq/compound": { input: 0.0005, output: 0.0005 },

    // Gemini models (estimated pricing per 1K tokens)
    "gemini-2.5-flash": { input: 0.00015, output: 0.0006 },
    "gemini-2.5-pro": { input: 0.00125, output: 0.005 },
    "gemini-2.0-flash": { input: 0.0001, output: 0.0004 },
    "gemini-2.0-flash-lite": { input: 0.000075, output: 0.0003 },

    // Default fallback
    "default": { input: 0.001, output: 0.002 },
  };

  const prices = PRICING[model] || PRICING.default;
  return (inputTokens / 1000 * prices.input) + (outputTokens / 1000 * prices.output);
}
