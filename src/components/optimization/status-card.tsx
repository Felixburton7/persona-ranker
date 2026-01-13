import { useState, useEffect } from "react";
import { cn } from "@/core/utils";
import { OptimizationRun, PromptVersion } from "./types";

interface OptimizationStatusProps {
    activeRun: OptimizationRun | null;
    starting: boolean;
    commentary: string;
    promptVersions: PromptVersion[];
    currentPrompt: PromptVersion | null;
    onVersionSelect: (version: PromptVersion) => void;
}

const EVALUATION_MESSAGES = [
    "Running Optimization",
    "Evaluating prompt on test leads...",
    "This is normally the longest bit",
    "Benchmarking against evaluation set...",
    "Running Optimization",
    "Processing evaluation data...",
];

export function OptimizationStatus({
    activeRun,
    starting,
    commentary,
    promptVersions,
    currentPrompt,
    onVersionSelect
}: OptimizationStatusProps) {
    const [rotatingMessageIndex, setRotatingMessageIndex] = useState(0);

    // Rotating messages effect
    useEffect(() => {
        const shouldRotate = activeRun &&
            activeRun.iterations_completed === 0 &&
            !commentary;

        if (!shouldRotate) return;

        const interval = setInterval(() => {
            setRotatingMessageIndex((prev) => (prev + 1) % EVALUATION_MESSAGES.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [activeRun, commentary]);

    const formatDuration = (start: string | null, end: string | null) => {
        if (!start) return "—";
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : Date.now();
        const seconds = Math.floor((endTime - startTime) / 1000);

        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    };

    const skeletonRun: OptimizationRun = {
        id: "loading",
        status: "pending",
        max_iterations: 5,
        iterations_completed: 0,
        started_at: new Date().toISOString(),
        completed_at: null,
        improvement_history: []
    };

    const displayRun = activeRun || (starting ? skeletonRun : null);

    if (!displayRun) return null;

    return (
        <div className="border-2 border-[#121212] bg-[#F9F8F4] p-8 rounded-xl relative overflow-hidden h-full">
            {/* Decorative Background */}
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#D0C3FC] rounded-full blur-[80px] opacity-50" />

            <div className="relative z-10 space-y-8">
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium mb-2">
                        <span className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            {displayRun.status === 'pending' ? 'Booting Optimization' : 'Running Optimization'}
                        </span>
                        <span className="font-mono text-[#78716c]">
                            {formatDuration(displayRun.started_at, displayRun.completed_at)}
                        </span>
                    </div>
                    <div className="h-2 w-full bg-[#E5E5E5] rounded-full overflow-hidden relative">
                        {!activeRun ? (
                            <div className="absolute inset-0 bg-gradient-to-r from-[#E5E5E5] via-[#d4d4d4] to-[#E5E5E5] animate-[shimmer_1.5s_infinite] w-full" />
                        ) : (
                            <div
                                className="h-full bg-[#121212] transition-all duration-500 ease-out"
                                style={{ width: `${Math.max((displayRun.iterations_completed / displayRun.max_iterations) * 100, 5)}%` }}
                            />
                        )}
                    </div>
                    <div className="flex justify-between text-xs font-mono text-[#78716c] pt-1">
                        <span>ITERATION {displayRun.iterations_completed + 1}/{displayRun.max_iterations}</span>
                        <span>
                            {!activeRun ? "INITIALIZING..." : `${Math.round((displayRun.iterations_completed / displayRun.max_iterations) * 100)}% COMPLETE`}
                        </span>
                    </div>
                </div>

                <div className="bg-white/60 backdrop-blur-sm border border-[#E5E5E5] p-5 rounded-lg space-y-4">
                    <div className="font-mono text-xs text-[#78716c] uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#D0C3FC] animate-pulse" />
                            Live Activity Log
                        </div>
                        {displayRun.improvement_history && displayRun.improvement_history.length > 0 && (
                            <div className="flex items-center gap-2">
                                {displayRun.improvement_history.map(iter => (
                                    <button
                                        key={iter.iteration}
                                        onClick={() => {
                                            const version = promptVersions.find(v => v.version === iter.iteration);
                                            if (version) {
                                                onVersionSelect(version);
                                            }
                                        }}
                                        className={cn(
                                            "px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors",
                                            currentPrompt?.version === iter.iteration
                                                ? "bg-[#121212] text-white"
                                                : "bg-[#E5E5E5] text-[#78716c] hover:bg-[#d4d4d4]"
                                        )}
                                    >
                                        v{iter.iteration}
                                    </button>
                                ))}
                                <div className="w-[1px] h-3 bg-[#E5E5E5] mx-1" />
                                <div className="text-green-600 font-bold">
                                    {(displayRun.improvement_history[displayRun.improvement_history.length - 1].metrics.composite * 100).toFixed(1)}%
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="font-mono text-sm leading-relaxed min-h-[40px]">
                        <span className="text-[#121212] font-semibold mr-2">{">"}</span> {
                            commentary || (
                                starting && !activeRun ? (
                                    <span className="animate-pulse text-[#78716c]">Initializing Trigger.dev environment & queuing job...</span>
                                ) : (
                                    displayRun.iterations_completed === 0 ? EVALUATION_MESSAGES[rotatingMessageIndex] :
                                        displayRun.iterations_completed >= displayRun.max_iterations ? "Finalizing results & selecting best prompt..." :
                                            "Applying textual gradient descent to refine instructions..."
                                )
                            )
                        }
                        <span className="animate-pulse">_</span>
                    </p>

                    {/* Sub-steps Indicator */}
                    <div className="pt-4 border-t border-[#E5E5E5] grid grid-cols-4 gap-4">
                        {[
                            { label: 'Evaluate', active: (commentary.toLowerCase().includes('evaluating') || (!commentary && displayRun.iterations_completed === 0)) && !commentary.toLowerCase().includes('identifying') },
                            { label: 'Analyze', active: commentary.toLowerCase().includes('analyzing') || commentary.toLowerCase().includes('identifying') },
                            { label: 'Edit', active: commentary.toLowerCase().includes('improving') || commentary.toLowerCase().includes('applying') || (displayRun.iterations_completed > 0 && !commentary) },
                            { label: 'Next', active: false }
                        ].map((step, i) => (
                            <div key={i} className="flex flex-col gap-1.5">
                                <div className={cn(
                                    "h-1 rounded-full",
                                    step.active ? "bg-[#121212]" : "bg-[#E5E5E5]"
                                )} />
                                <span className={cn(
                                    "text-[10px] font-mono uppercase tracking-tighter text-center",
                                    step.active ? "text-[#121212] font-bold" : "text-[#a3a3a3]"
                                )}>
                                    {step.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Evolution Track */}
                    <div className="pt-6 border-t border-[#E5E5E5]">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-mono text-[#78716c] uppercase">v1 → v5 Evolution</span>
                            <span className="text-[10px] font-mono text-[#121212] font-bold">
                                {displayRun.status === 'pending' ? 'PREPARING...' : `ITERATION ${displayRun.iterations_completed + 1}`}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((v) => (
                                <div
                                    key={v}
                                    className={cn(
                                        "flex-1 h-3 rounded-sm transition-all duration-700",
                                        displayRun.status === 'pending'
                                            ? "bg-[#E5E5E5] animate-pulse"
                                            : v <= displayRun.iterations_completed
                                                ? "bg-[#121212]"
                                                : v === displayRun.iterations_completed + 1
                                                    ? "bg-[#121212]/20 animate-pulse"
                                                    : "bg-[#E5E5E5]"
                                    )}
                                    style={{
                                        animationDelay: displayRun.status === 'pending' ? `${v * 150}ms` : '0ms'
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
