import { createServerClient } from "@/core/db/client";

const supabase = createServerClient();

// Simple decryption function (matches the encryption in the API route)
function simpleDecrypt(encrypted: string, key: string = process.env.ENCRYPTION_KEY || "default-key"): string {
    try {
        const text = Buffer.from(encrypted, "base64").toString();
        let result = "";
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    } catch {
        return encrypted; // Return as-is if decryption fails
    }
}

export interface StoredApiKey {
    id: string;
    provider: string;
    model_name: string;
    api_key: string;
    base_url?: string;
    is_active: boolean;
}

/**
 * Fetch API key configuration for a specific model
 */
export async function getApiKeyForModel(modelName: string): Promise<StoredApiKey | null> {
    try {
        if (!supabase) return null;
        const { data, error } = await supabase
            .from("api_keys")
            .select("*")
            .eq("model_name", modelName)
            .eq("is_active", true)
            .single();

        if (error || !data) return null;

        // Decrypt the API key
        return {
            ...data,
            api_key: simpleDecrypt(data.api_key)
        };
    } catch {
        return null;
    }
}

/**
 * Fetch all active API keys
 */
export async function getAllApiKeys(): Promise<StoredApiKey[]> {
    try {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from("api_keys")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (error || !data) return [];

        // Decrypt all API keys
        return data.map(key => ({
            ...key,
            api_key: simpleDecrypt(key.api_key)
        }));
    } catch {
        return [];
    }
}

/**
 * Get API key for a model with fallback to environment variable
 */
export async function getApiKeyWithFallback(modelName: string, envKey: string = "GROQ_API_KEY"): Promise<string> {
    const storedKey = await getApiKeyForModel(modelName);

    if (storedKey?.api_key) {
        return storedKey.api_key;
    }

    // Fallback to environment variable
    return process.env[envKey] || process.env.GROQ_API_KEY || "dummy_key_for_build";
}

/**
 * Get base URL for a model with fallback to default
 */
export async function getBaseUrlForModel(modelName: string, defaultUrl: string = "https://api.groq.com/openai/v1"): Promise<string> {
    const storedKey = await getApiKeyForModel(modelName);

    if (storedKey?.base_url) {
        return storedKey.base_url;
    }

    return defaultUrl;
}
