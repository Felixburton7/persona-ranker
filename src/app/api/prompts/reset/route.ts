
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildRankingPrompt } from "@/lib/ranking/prompt";

const createSupabaseClient = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
        console.warn("Supabase credentials missing in environment variables");
        return null;
    }

    return createClient(url, key);
};

const supabase = createSupabaseClient();

export async function POST() {
    try {
        if (!supabase) {
            return NextResponse.json(
                { error: "Database connection not available" },
                { status: 503 }
            );
        }

        // 0. Cancel any active runs to prevent UI weirdness
        const { error: cancelError } = await supabase
            .from("optimization_runs")
            .update({
                status: "failed",
                error_message: "Reset by user (Force Stop)"
            })
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

        // 2. Get latest version number
        const { data: latest } = await supabase
            .from("prompt_versions")
            .select("version")
            .order("version", { ascending: false })
            .limit(1)
            .single();

        const nextVersion = (latest?.version || 0) + 1;

        // 3. Deactivate all existing prompts
        await supabase
            .from("prompt_versions")
            .update({ is_active: false })
            .eq("is_active", true);

        // 4. Insert new "Reset" prompt
        const { data: newPrompt, error } = await supabase
            .from("prompt_versions")
            .insert({
                version: nextVersion,
                prompt_text: defaultPrompt,
                is_active: true,
                gradient_summary: "Reset to default template",
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
