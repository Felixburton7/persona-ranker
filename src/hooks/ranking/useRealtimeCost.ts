"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/core/db/client";

export function useRealtimeCost(jobId: string | null) {
    const [cost, setCost] = useState(0);

    useEffect(() => {
        if (!jobId) {
            setCost(0);
            return;
        }

        // Initial fetch
        const fetchCost = async () => {
            const { data, error } = await supabase
                .from("ai_calls")
                .select("estimated_cost_usd")
                .eq("job_id", jobId);

            if (data) {
                const total = data.reduce((acc, curr) => acc + (Number(curr.estimated_cost_usd) || 0), 0);
                setCost(total);
            }
        };

        fetchCost();

        // Subscribe to new calls
        const channel = supabase
            .channel(`cost-${jobId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "ai_calls",
                    filter: `job_id=eq.${jobId}`,
                },
                (payload) => {
                    const newCost = Number(payload.new.estimated_cost_usd) || 0;
                    setCost((prev) => prev + newCost);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [jobId]);

    return cost;
}
