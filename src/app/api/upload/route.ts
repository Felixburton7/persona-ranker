import { NextRequest } from "next/server";
import { processCsvUpload } from "@/features/ingestion";
import { success, error, withErrorHandler } from "@/core/api-response";
import { ValidationError } from "@/core/errors";

export const maxDuration = 60;

export const POST = withErrorHandler(async (req: NextRequest) => {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const preferredModel = formData.get("preferredModel") as string | null;
    const apiKey = formData.get("apiKey") as string | null;
    const geminiApiKey = formData.get("geminiApiKey") as string | null;

    if (!file) {
        throw new ValidationError("No file provided", ["file"]);
    }

    const text = await file.text();
    const result = await processCsvUpload(
        text,
        preferredModel || undefined,
        apiKey || undefined,
        geminiApiKey || undefined
    );

    return success(result);
});

