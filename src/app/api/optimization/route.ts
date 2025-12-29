/**
 * API Route: Prompt Optimization
 * 
 * POST: Start a new optimization run
 * GET: Get status of an optimization run
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tasks } from "@trigger.dev/sdk/v3";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const dynamic = 'force-dynamic';

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

export async function POST(request: NextRequest) {
    try {
        if (!supabase) {
            return NextResponse.json(
                { error: "Database connection not available" },
                { status: 503 }
            );
        }

        // Check content type to determine if it's a file upload or JSON
        const contentType = request.headers.get("content-type") || "";

        let maxIterations = 3;
        let evalSetPath: string | undefined = undefined;
        let evalSetContent: string | undefined = undefined;

        if (contentType.includes("multipart/form-data")) {
            // Handle file upload
            const formData = await request.formData();
            maxIterations = parseInt(formData.get("maxIterations") as string) || 3;

            const evalSetFile = formData.get("evalSetCsv") as File | null;
            if (evalSetFile && evalSetFile.size > 0) {
                // Save to temp directory
                const tempDir = os.tmpdir();
                const fileName = `eval_set_${Date.now()}.csv`;
                evalSetPath = path.join(tempDir, fileName);

                const fileContent = await evalSetFile.text();
                evalSetContent = fileContent; // Store content for trigger task
                fs.writeFileSync(evalSetPath, fileContent);

                console.log(`Custom eval set saved to ${evalSetPath} (${evalSetFile.size} bytes)`);
            }
        } else {
            // Handle JSON body
            const body = await request.json().catch(() => ({}));
            maxIterations = body.maxIterations || 3;
            evalSetContent = body.evalSetContent; // Direct content if provided
        }

        // Create optimization run record
        const { data: run, error: createError } = await supabase
            .from("optimization_runs")
            .insert({
                status: "pending",
                max_iterations: maxIterations,
                iterations_completed: 0,
                improvement_history: [],
            })
            .select()
            .single();

        if (createError) {
            return NextResponse.json(
                { error: `Failed to create run: ${createError.message}` },
                { status: 500 }
            );
        }

        // Trigger the optimization task
        try {
            // Note: This requires the optimize-prompt task to be registered in Trigger.dev
            const handle = await tasks.trigger("optimize-prompt", {
                runId: run.id,
                maxIterations,
                evalSetPath, // Pass custom eval set path if uploaded
            });

            // Update run with trigger handle ID
            await supabase
                .from("optimization_runs")
                .update({
                    // Store the trigger run ID for tracking (if available)
                })
                .eq("id", run.id);

            return NextResponse.json({
                success: true,
                runId: run.id,
                message: "Optimization started",
                triggerHandle: handle,
            });
        } catch (triggerError: any) {
            // If trigger fails, mark run as failed
            await supabase
                .from("optimization_runs")
                .update({ status: "failed" })
                .eq("id", run.id);

            return NextResponse.json(
                { error: `Failed to start optimization: ${triggerError.message}` },
                { status: 500 }
            );
        }
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Unknown error" },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    if (!supabase) {
        return NextResponse.json(
            { error: "Database connection not available" },
            { status: 503 }
        );
    }
    const url = new URL(request.url);
    const runId = url.searchParams.get("runId");

    try {
        if (runId) {
            // Get specific run
            const { data: run, error } = await supabase
                .from("optimization_runs")
                .select(`
          *,
          best_prompt:prompt_versions!optimization_runs_best_prompt_id_fkey(
            id, version, composite_score, relevance_f1, ranking_ndcg_at_3
          )
        `)
                .eq("id", runId)
                .single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }

            return NextResponse.json(run);
        } else {
            // Get all runs (most recent first)
            const { data: runs, error } = await supabase
                .from("optimization_runs")
                .select(`
          *,
          best_prompt:prompt_versions!optimization_runs_best_prompt_id_fkey(
            id, version, composite_score
          )
        `)
                .order("created_at", { ascending: false })
                .limit(10);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ runs });
        }
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Unknown error" },
            { status: 500 }
        );
    }
}
