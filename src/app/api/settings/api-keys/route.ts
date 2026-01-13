import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/core/db/client";

const supabase = createServerClient();

// Simple encryption/decryption (in production, use a proper encryption library)
// This is a basic XOR cipher for demonstration - replace with proper encryption in production
function simpleEncrypt(text: string, key: string = process.env.ENCRYPTION_KEY || "default-key"): string {
    let result = "";
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return Buffer.from(result).toString("base64");
}

function simpleDecrypt(encrypted: string, key: string = process.env.ENCRYPTION_KEY || "default-key"): string {
    const text = Buffer.from(encrypted, "base64").toString();
    let result = "";
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
}

// GET - Fetch all API keys
export async function GET(req: NextRequest) {
    try {
        if (!supabase) {
            return NextResponse.json({ error: "Database connection not available" }, { status: 503 });
        }
        const { data, error } = await supabase
            .from("api_keys")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Decrypt API keys before sending to client
        const decryptedKeys = (data || []).map(key => ({
            ...key,
            api_key: simpleDecrypt(key.api_key)
        }));

        return NextResponse.json({ keys: decryptedKeys });
    } catch (error: any) {
        console.error("Failed to fetch API keys:", error);
        return NextResponse.json(
            { error: "Failed to fetch API keys" },
            { status: 500 }
        );
    }
}

// POST - Add or update API key
export async function POST(req: NextRequest) {
    try {
        if (!supabase) {
            return NextResponse.json({ error: "Database connection not available" }, { status: 503 });
        }
        const body = await req.json();
        const { provider, model_name, api_key, base_url, display_name } = body;

        if (!provider || !model_name || !api_key) {
            return NextResponse.json(
                { error: "Provider, model_name, and api_key are required" },
                { status: 400 }
            );
        }

        // Encrypt the API key before storing
        const encryptedKey = simpleEncrypt(api_key);

        // Upsert (insert or update if exists)
        const { data, error } = await supabase
            .from("api_keys")
            .upsert(
                {
                    provider,
                    model_name,
                    api_key: encryptedKey,
                    base_url,
                    display_name: display_name || model_name,
                    is_active: true
                },
                {
                    onConflict: "provider,model_name"
                }
            )
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, key: data });
    } catch (error: any) {
        console.error("Failed to save API key:", error);
        return NextResponse.json(
            { error: "Failed to save API key: " + error.message },
            { status: 500 }
        );
    }
}

// DELETE - Remove an API key
export async function DELETE(req: NextRequest) {
    try {
        if (!supabase) {
            return NextResponse.json({ error: "Database connection not available" }, { status: 503 });
        }
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "ID parameter is required" },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from("api_keys")
            .delete()
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Failed to delete API key:", error);
        return NextResponse.json(
            { error: "Failed to delete API key" },
            { status: 500 }
        );
    }
}
