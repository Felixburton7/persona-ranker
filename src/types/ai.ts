/**
 * Session Keys Type
 * 
 * Represents API keys passed for a specific session.
 * Used to pass user-provided API keys to AI providers.
 */
export interface SessionKeys {
    groq?: string;
    gemini?: string;
}
