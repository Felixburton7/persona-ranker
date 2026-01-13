import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/core/db/client";
import { buildRankingPrompt } from "@/features/ranking/prompt";

const supabase = createServerClient();

export async function POST(request: NextRequest) {
    try {
        const sessionKey = request.headers.get("x-session-key");
        if (!sessionKey) {
            return NextResponse.json({ error: "Session key required" }, { status: 400 });
        }

        if (!supabase) {
            return NextResponse.json(
                { error: "Database connection not available" },
                { status: 503 }
            );
        }

        // 0. Cancel any active runs FOR THIS SESSION to prevent UI weirdness
        const { error: cancelError } = await supabase
            .from("optimization_runs")
            .update({
                status: "failed",
                error_message: "Reset by user (Force Stop)"
            })
            .eq("session_key", sessionKey) // Scoped
            .neq("status", "completed")
            .neq("status", "failed");

        if (cancelError) {
            console.error("Failed to cancel active runs during reset:", cancelError);
        }

        // 1. Generate default prompt
        const { prompt: defaultPrompt } = buildRankingPrompt(
            { name: "PLACEHOLDER", size_bucket: "smb", employee_range: "51-200" },
            [{ id: "test", full_name: "Test User", title: "VP Sales" }]
        );

        // 2. Get latest version number FOR THIS SESSION
        const { data: latest } = await supabase
            .from("prompt_versions")
            .select("version")
            .eq("session_key", sessionKey) // Scoped
            .order("version", { ascending: false })
            .limit(1)
            .single();

        const nextVersion = (latest?.version || 0) + 1;

        // 3. Deactivate all existing prompts FOR THIS SESSION
        await supabase
            .from("prompt_versions")
            .update({ is_active: false })
            .eq("session_key", sessionKey) // Scoped
            .eq("is_active", true);

        // 4. Insert new "Reset" prompt FOR THIS SESSION
        const { data: newPrompt, error } = await supabase
            .from("prompt_versions")
            .insert({
                version: nextVersion,
                prompt_text: defaultPrompt,
                is_active: true,
                gradient_summary: "Reset to default template",
                session_key: sessionKey // Scoped
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: `Failed to reset prompt: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Prompt reset to default",
            prompt: newPrompt
        });

    } catch (error: any) {
        console.error("Error resetting prompt:", error);
        return NextResponse.json(
            { error: error.message || "Failed to reset prompt" },
            { status: 500 }
        );
    }
}
