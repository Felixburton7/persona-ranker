"use client";

import { useRealtimeCost } from "@/hooks";
import { useEffect, useState } from "react";
import { cn } from "@/core/utils";

export function CostTicker({ jobId, className }: { jobId: string | null, className?: string }) {
    const cost = useRealtimeCost(jobId);
    const [prevCost, setPrevCost] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (cost !== prevCost) {
            setIsUpdating(true);
            const timer = setTimeout(() => setIsUpdating(false), 500);
            setPrevCost(cost);
            return () => clearTimeout(timer);
        }
    }, [cost, prevCost]);

    if (!jobId) return null;

    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-200 rounded-full shadow-sm text-xs font-medium text-stone-600 animate-in fade-in slide-in-from-top-4 duration-700 select-none",
            className
        )}>
            <div className="flex items-center gap-1.5">
                <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
                <span className="text-stone-500 uppercase tracking-wider text-[10px] font-bold">Live Cost</span>
            </div>

            <span className={cn(
                "font-mono text-stone-900 transition-all duration-300 min-w-[60px] text-right",
                isUpdating && "text-emerald-600 scale-105"
            )}>
                ${cost.toFixed(4)}
            </span>
        </div>
    );
}
