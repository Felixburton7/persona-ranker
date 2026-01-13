"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/core/db/client";
import { JobProgress } from "@/types/jobs";

// Re-export for backward compatibility
export type { JobProgress } from "@/types/jobs";

export function useJobProgress(jobId: string | null) {
    const [progress, setProgress] = useState<JobProgress | null>(null);

    useEffect(() => {
        if (!jobId) {
            setProgress(null);
            return;
        }

        // Reset progress when jobId changes to avoid showing stale data
        setProgress(null);

        let pollingInterval: NodeJS.Timeout;

        const fetchData = async () => {
            const { data } = await supabase
                .from("ranking_jobs")
                .select("*")
                .eq("id", jobId)
                .single();

            if (data) {
                setProgress(prev => {
                    // Only update if we don't have data yet or if the new data is actually newer/different
                    if (!prev) return data as JobProgress;

                    // Simple logic: if the job is already completed/failed in our state, don't overwrite with older data
                    if (prev.status === 'completed' || prev.status === 'failed') {
                        if (data.status !== 'completed' && data.status !== 'failed') return prev;
                    }

                    return { ...prev, ...data } as JobProgress;
                });
            }
        };

        // Initial fetch
        fetchData();

        // Subscribe to realtime updates
        const channel = supabase
            .channel(`job-progress-${jobId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "ranking_jobs",
                },
                (payload) => {
                    // Check ID manually as filters can be flaky
                    if (payload.new && payload.new.id === jobId) {
                        setProgress(prev => ({
                            ...(prev || {}),
                            ...payload.new
                        } as JobProgress));
                    }
                }
            )
            .subscribe();

        // Fallback polling (every 3 seconds)
        pollingInterval = setInterval(fetchData, 3000);

        return () => {
            supabase.removeChannel(channel);
            if (pollingInterval) clearInterval(pollingInterval);
        };
    }, [jobId]);

    return progress;
}
