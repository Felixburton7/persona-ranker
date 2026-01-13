/**
 * Supabase Client Configuration
 * 
 * Exports:
 * - `supabase`: Client-side Supabase client using NEXT_PUBLIC_* env vars
 * - `createServerClient()`: Factory for server-side client using SUPABASE_* env vars
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// =============================================================================
// CLIENT-SIDE CLIENT (uses NEXT_PUBLIC_* env vars, safe for browser)
// =============================================================================

/**
 * Lazy initialization to avoid build-time errors.
 * Environment variables may not be available during build.
 */
function getSupabaseClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        // During build time (SSR), environment variables might not be set
        // Return a dummy client to prevent build failures
        // Runtime errors will occur when the client is actually used
        if (typeof window === 'undefined') {
            // Server-side: return dummy client during build
            return createClient("https://placeholder.supabase.co", "placeholder-key");
        }
        // Client-side: throw error since env vars should be available
        throw new Error("Missing Supabase environment variables");
    }

    return createClient(url, key);
}

/** Client-side Supabase client - use in React components and hooks */
export const supabase = getSupabaseClient();

// =============================================================================
// SERVER-SIDE CLIENT (uses SUPABASE_* env vars, for API routes and triggers)
// =============================================================================

/**
 * Creates a server-side Supabase client with service role key.
 * Use this in API routes and server-side code.
 * 
 * @returns SupabaseClient or null if credentials are missing
 */
export function createServerClient(): SupabaseClient | null {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
        console.warn("Supabase credentials missing in environment variables");
        return null;
    }
    return createClient(url, key);
}
