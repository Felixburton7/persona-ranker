"use client";

import { useJobProgress } from "@/hooks";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { useRunningCommentary } from "@/hooks";
import { CostTicker } from "@/components/ranking/cost-ticker";
import { UPDATING_INDICATOR_RESET_MS, NEARLY_THERE_THRESHOLD } from "@/core/constants";
import styles from "./progress.module.css";

export function RankingProgress({ jobId }: { jobId: string }) {
    const progress = useJobProgress(jobId);
    const commentary = useRunningCommentary(jobId);
    const [prevLeadsProcessed, setPrevLeadsProcessed] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (progress && progress.processed_leads !== prevLeadsProcessed) {
            setIsUpdating(true);
            setPrevLeadsProcessed(progress.processed_leads);
            const timer = setTimeout(() => setIsUpdating(false), UPDATING_INDICATOR_RESET_MS);
            return () => clearTimeout(timer);
        }
    }, [progress?.processed_leads, prevLeadsProcessed]);

    if (!progress) return null;

    // Show partial completion warning
    if (progress.status === "completed" && progress.partial_completion && progress.skipped_leads_count && progress.skipped_leads_count > 0) {
        const processedLeads = progress.total_leads - progress.skipped_leads_count;
        return (
            <div className="p-4 border border-amber-200 rounded-lg bg-amber-50 space-y-2 my-4">
                <div className="flex items-center gap-2 text-amber-800 font-semibold">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                    Partial Completion - Rate Limit Reached
                </div>
                <p className="text-sm text-amber-700 pl-7">
                    <strong>{processedLeads} of {progress.total_leads} leads</strong> were successfully ranked.
                    <strong className="text-amber-900"> {progress.skipped_leads_count} leads</strong> could not be processed because all AI models reached their rate limits.
                </p>
                <p className="text-xs text-amber-600 pl-7 mt-1">
                    The results shown are complete for the leads that were processed. You can try again later when rate limits reset, or upgrade your API tier.
                </p>
            </div>
        );
    }

    if (progress.status === "failed") {
        return (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50 space-y-2 my-4">
                <div className="flex items-center gap-2 text-red-800 font-semibold">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                    Job Failed
                </div>
                <p className="text-sm text-red-600 pl-7">
                    {progress.error || "An unknown error occurred during processing."}
                </p>
                <div className="pl-7 mt-2">
                    <button onClick={() => window.location.reload()} className="text-xs text-red-700 underline hover:text-red-900">
                        Refresh page to try again
                    </button>
                </div>
            </div>
        );
    }

    const percent = progress.total_leads > 0
        ? (progress.processed_leads / progress.total_leads) * 100
        : 0;

    const companyPercent = progress.total_companies > 0
        ? (progress.processed_companies / progress.total_companies) * 100
        : 0;

    const isRunning = progress.status === "running" || progress.status === "pending";
    const isNearlyThere = percent > NEARLY_THERE_THRESHOLD && percent < 100;

    return (
        <div className={styles.container}>
            {/* Background texture or subtle gradient */}
            <div className={styles.backgroundTexture} />

            <div className={styles.content}>
                {/* Main Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <div className="text-sm font-medium text-stone-900">Ranking Progress</div>
                        <span className="text-2xl font-bold tracking-tight text-stone-900">
                            {Math.round(percent)}%
                        </span>
                    </div>
                    <Progress value={percent} className="h-2 transition-all duration-500" />
                    <div className="flex justify-between text-xs text-stone-400">
                        <span>Individual Leads Analyzed</span>
                        <div className="flex items-center gap-2">
                            {isNearlyThere && <span className={styles.nearlyThere}>Nearly There!</span>}
                            <span className={`${styles.statsCounter} ${isUpdating ? styles.countUpdating : ""}`}>
                                {progress.processed_leads} / {progress.total_leads}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Secondary Stats (Companies) */}
                <div className="pt-2 border-t border-dashed">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-stone-500">Companies Processed</span>
                        <span className="font-mono font-medium">
                            {progress.processed_companies} / {progress.total_companies}
                        </span>
                    </div>
                </div>

                {/* AI Thoughts / Live Log */}
                {isRunning && (
                    <div className="space-y-3">
                        <div className="bg-stone-50 border border-stone-100 rounded-md p-3 flex items-start gap-3 transition-all duration-500">
                            <div className={`${styles.statusIndicator} ${styles.pulseIndicator}`} />
                            <div className="space-y-1 flex-1">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                                        What's Happening
                                    </div>
                                    <CostTicker jobId={jobId} className="py-0.5 px-2 bg-transparent border-none shadow-none scale-90 origin-right" />
                                </div>
                                <div key={commentary} className="text-sm text-stone-700 font-mono leading-relaxed animate-in fade-in slide-in-from-bottom-1 duration-300">
                                    {commentary || (progress.rate_limit_error ? "⚠️ Rate limits reached - waiting for capacity..." : "Ready for action...")}
                                </div>
                            </div>
                        </div>

                        {/* Rate Limit Warning - Show when rate limits are detected */}
                        {progress.rate_limit_error && (
                            <div className="bg-red-50 rounded-md p-3 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="mt-0.5 shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" x2="12" y1="8" y2="12" />
                                        <line x1="12" x2="12.01" y1="16" y2="16" />
                                    </svg>
                                </div>
                                <div className="space-y-1 flex-1">
                                    <div className="text-sm font-bold text-red-700 uppercase tracking-wide">
                                        API Rate Limit Exceeded
                                    </div>
                                    <div className="text-xs text-red-600">
                                        All available API capacity has been exhausted. Remaining leads will be skipped until rate limits reset.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
