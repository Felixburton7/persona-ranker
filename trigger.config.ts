import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
    project: "proj_aypixfhbkaazxnmzuuji",
    runtime: "node",
    logLevel: "log",
    maxDuration: 60,
    retries: {
        enabledInDev: true,
        default: {
            maxAttempts: 3,
            minTimeoutInMs: 1000,
            maxTimeoutInMs: 10000,
        },
    },
    additionalFiles: ["./_assets/initial_documents/eval_set.csv - Evaluation Set.csv"],
});
