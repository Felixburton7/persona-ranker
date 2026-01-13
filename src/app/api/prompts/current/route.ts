import { NextResponse } from "next/server";
import { createServerClient } from "@/core/db/client";

const supabase = createServerClient();

/**
 * GET /api/prompts/current
 * Returns the currently active prompt version
 */
export async function GET() {
    try {
        if (!supabase) {
            return NextResponse.json(
                { error: "Database connection not available" },
                { status: 503 }
            );
        }

        const { data, error } = await supabase
            .from("prompt_versions")
            .select("id, version, prompt_text, is_active, composite_score")
            .eq("is_active", true)
            .single();

        let currentPrompt;

        if (error || !data) {
            const { data: latestPrompt, error: latestError } = await supabase
                .from("prompt_versions")
                .select("id, version, prompt_text, is_active, composite_score")
                .order("version", { ascending: false })
                .limit(1)
                .single();

            if (latestError || !latestPrompt) {
                return NextResponse.json(
                    { error: "No prompts found" },
                    { status: 404 }
                );
            }
            currentPrompt = latestPrompt;
        } else {
            currentPrompt = data;
        }

        // Fetch previous version for diffing
        let previousPromptText: string | null = null;
        if (currentPrompt.version > 1) {
            const { data: prevData } = await supabase
                .from("prompt_versions")
                .select("prompt_text")
                .eq("version", currentPrompt.version - 1)
                .single();

            if (prevData) {
                previousPromptText = prevData.prompt_text;
            }
        }

        return NextResponse.json({
            prompt: currentPrompt,
            previous_text: previousPromptText
        });
    } catch (error) {
        console.error("Error fetching current prompt:", error);
        return NextResponse.json(
            { error: "Failed to fetch current prompt" },
            { status: 500 }
        );
    }
}
