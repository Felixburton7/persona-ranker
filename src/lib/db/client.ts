
import { createClient } from "@supabase/supabase-js";

// Lazy initialization to avoid build-time errors
// Environment variables may not be available during build
function getSupabaseClient() {
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

export const supabase = getSupabaseClient();
