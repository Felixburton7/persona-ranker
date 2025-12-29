import { NextRequest, NextResponse } from "next/server";
import { processCsvUpload } from "@/lib/ingestion";

export const maxDuration = 60; // Support longer processing for parsing

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const preferredModel = formData.get("preferredModel") as string | null;
        const apiKey = formData.get("apiKey") as string | null;
        const geminiApiKey = formData.get("geminiApiKey") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const text = await file.text();
        const result = await processCsvUpload(text, preferredModel || undefined, apiKey || undefined, geminiApiKey || undefined);

        return NextResponse.json(result);
    } catch (e) {
        console.error("Upload failed:", e);
        return NextResponse.json(
            { error: (e as Error).message },
            { status: 500 }
        );
    }
}
