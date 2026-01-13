import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Zap, GitBranch, ChevronUp, ChevronDown, Check, Activity, AlertCircle } from "lucide-react";
import { cn } from "@/core/utils";
import { OptimizationRun, PromptVersion } from "./types";

interface OptimizationHistoryProps {
    activeRun: OptimizationRun | null;
    runs: OptimizationRun[];
    promptVersions: PromptVersion[];
    currentPrompt: PromptVersion | null;
    onVersionSelect: (version: PromptVersion) => void;
}

export function OptimizationHistory({
    activeRun,
    runs,
    promptVersions,
    currentPrompt,
    onVersionSelect
}: OptimizationHistoryProps) {
    const [expandedRun, setExpandedRun] = useState<string | null>(null);

    const completedRuns = runs.filter(r => r.status === "completed" || r.status === "failed");

    const formatDuration = (start: string | null, end: string | null) => {
        if (!start) return "—";
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : Date.now();
        const seconds = Math.floor((endTime - startTime) / 1000);

        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    };

    return (
        <div>
            {/* Latest Refinement */}
            {activeRun && activeRun.improvement_history && activeRun.improvement_history.length > 0 && (
                <div className="mb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#D0C3FC] flex items-center justify-center">
                                <Zap className="w-4 h-4 text-[#121212]" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Latest AI Refinement</h2>
                                <p className="text-xs text-[#78716c]">Insights from the most recent optimization iteration</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-[#F9F8F4] border border-[#E5E5E5] rounded-lg p-1">
                            {activeRun.improvement_history.map(iter => (
                                <button
                                    key={iter.iteration}
                                    onClick={() => {
                                        const version = promptVersions.find(v => v.version === iter.iteration);
                                        if (version) {
                                            onVersionSelect(version);
                                        }
                                    }}
                                    className={cn(
                                        "px-3 py-1 text-xs font-mono rounded transition-all",
                                        currentPrompt?.version === iter.iteration
                                            ? "bg-[#121212] text-white shadow-md scale-105"
                                            : "text-[#78716c] hover:bg-[#E5E5E5]"
                                    )}
                                >
                                    v{iter.iteration}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-[#FAF9F6] border-2 border-[#121212] rounded-xl p-6 shadow-[3px_3px_0px_0px_rgba(18,18,18,1)]">
                            {(() => {
                                const lastIter = activeRun.improvement_history[activeRun.improvement_history.length - 1];
                                return (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between border-b border-[#121212]/10 pb-4">
                                            <Badge className="bg-[#121212] text-white hover:bg-[#121212] rounded-md px-3 py-1 font-mono text-xs">
                                                ITERATION {lastIter.iteration}
                                            </Badge>
                                            <div className="flex items-center gap-1.5">
                                                <div className={cn("w-2 h-2 rounded-full", lastIter.improved ? "bg-green-500" : "bg-amber-500")} />
                                                <span className="text-xs font-bold uppercase tracking-wider">
                                                    {lastIter.improved ? "Improved Performance" : "Refining Logic"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <span className="text-[10px] font-mono font-bold text-[#78716c] uppercase mb-1 block">Root Cause Observation</span>
                                                <p className="text-base font-medium leading-relaxed font-serif italic text-[#121212]">
                                                    "{lastIter.gradient?.summary || "Analyzing error patterns..."}"
                                                </p>
                                            </div>

                                            {lastIter.gradient?.suggestedImprovements && (
                                                <div className="grid md:grid-cols-2 gap-4 mt-8">
                                                    {lastIter.gradient.suggestedImprovements.slice(0, 2).map((improve, idx) => (
                                                        <div key={idx} className="bg-white border border-[#E5E5E5] p-4 rounded-lg flex items-start gap-3 shadow-sm">
                                                            <div className="w-6 h-6 rounded-full bg-[#B4F7C3] flex-shrink-0 flex items-center justify-center">
                                                                <Check className="w-3 h-3 text-[#0f391a]" />
                                                            </div>
                                                            <p className="text-[13px] leading-snug font-medium text-[#121212]">{improve}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="bg-[#D0C3FC] border-2 border-[#121212] rounded-xl p-6 shadow-[3px_3px_0px_0px_rgba(18,18,18,1)] flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-base mb-2 flex items-center gap-2">
                                    <Activity className="w-4 h-4" />
                                    Performance Delta
                                </h4>
                                <p className="text-sm text-[#121212]/70 mb-8 leading-snug">
                                    Comparison of metrics between v{activeRun.iterations_completed} and v{activeRun.iterations_completed + 1}.
                                </p>

                                <div className="space-y-6">
                                    {[
                                        { label: 'Precision', val: activeRun.improvement_history[activeRun.improvement_history.length - 1].metrics.precision },
                                        { label: 'Recall', val: activeRun.improvement_history[activeRun.improvement_history.length - 1].metrics.recall },
                                        { label: 'NDCG@3', val: activeRun.improvement_history[activeRun.improvement_history.length - 1].metrics.ndcgAt3 }
                                    ].map((m, i) => (
                                        <div key={i} className="space-y-1.5">
                                            <div className="flex justify-between text-[11px] font-bold font-mono uppercase">
                                                <span>{m.label}</span>
                                                <span>{(m.val * 100).toFixed(1)}%</span>
                                            </div>
                                            <div className="h-2 bg-white/40 rounded-full overflow-hidden">
                                                <div className="h-full bg-[#121212] transition-all duration-1000" style={{ width: `${m.val * 100}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-8 pt-6 border-t border-[#121212]/10">
                                <div className="flex items-center gap-2 text-xs font-bold font-mono">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#121212] animate-ping" />
                                    ITERATIVE IMPROVEMENT IN PROGRESS
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Run History Table */}
            {completedRuns.length > 0 && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <GitBranch className="w-6 h-6" />
                        Run History
                    </h2>

                    <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
                        <div className="grid grid-cols-12 border-b border-[#E5E5E5] bg-[#FAFAFA] text-xs font-mono text-[#78716c] uppercase py-3 px-4">
                            <div className="col-span-3">Run ID</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Duration</div>
                            <div className="col-span-2">Score</div>
                            <div className="col-span-3 text-right">Details</div>
                        </div>

                        <div className="divide-y divide-[#E5E5E5]">
                            {completedRuns.map((run) => (
                                <div key={run.id} className="group hover:bg-[#FAFAFA] transition-colors">
                                    <div
                                        className="grid grid-cols-12 items-center py-4 px-4 cursor-pointer"
                                        onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                                    >
                                        <div className="col-span-3 font-mono text-sm text-[#121212]">
                                            #{run.id.slice(0, 8)}
                                        </div>
                                        <div className="col-span-2">
                                            <Badge variant="outline" className={cn(
                                                "border font-normal",
                                                run.status === 'completed' ? "bg-[#B4F7C3]/20 border-[#B4F7C3] text-green-700" :
                                                    "bg-red-50 border-red-200 text-red-700"
                                            )}>
                                                {run.status}
                                            </Badge>
                                        </div>
                                        <div className="col-span-2 text-sm text-[#78716c]">
                                            {formatDuration(run.started_at, run.completed_at)}
                                        </div>
                                        <div className="col-span-2">
                                            {run.best_prompt ? (
                                                <span className="font-mono font-bold text-[#121212]">
                                                    {(run.best_prompt.composite_score * 100).toFixed(1)}%
                                                </span>
                                            ) : (
                                                <span className="text-[#78716c]">-</span>
                                            )}
                                        </div>
                                        <div className="col-span-3 flex justify-end">
                                            {expandedRun === run.id ? <ChevronUp className="w-4 h-4 text-[#78716c]" /> : <ChevronDown className="w-4 h-4 text-[#78716c]" />}
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedRun === run.id && (
                                        <div className="bg-[#FAFAFA] border-t border-[#E5E5E5] p-6">
                                            <div className="grid md:grid-cols-3 gap-6">
                                                <div>
                                                    <h4 className="text-xs font-mono text-[#78716c] uppercase mb-3">Metrics</h4>
                                                    {run.status === "failed" && run.error_message === "rate_limit_exceeded" ? (
                                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <AlertCircle className="w-4 h-4 text-red-600" />
                                                                <span className="text-sm font-semibold text-red-900">Rate Limit Exceeded</span>
                                                            </div>
                                                            <p className="text-xs text-red-700">All AI models exhausted</p>
                                                        </div>
                                                    ) : run.best_prompt ? (
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-sm">
                                                                <span>Relevance F1</span>
                                                                <span className="font-mono font-bold">{(run.best_prompt.relevance_f1 * 100).toFixed(1)}%</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span>Ranking NDCG</span>
                                                                <span className="font-mono font-bold">{(run.best_prompt.ranking_ndcg_at_3 * 100).toFixed(1)}%</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-[#78716c]">No metrics available</p>
                                                    )}
                                                </div>

                                                <div className="col-span-2">
                                                    <h4 className="text-xs font-mono text-[#78716c] uppercase mb-3">Improvement Graph</h4>
                                                    {run.improvement_history && run.improvement_history.length > 0 ? (
                                                        <div className="flex items-end gap-2 h-24 border-b border-[#E5E5E5] pb-1">
                                                            {run.improvement_history.map((iter, idx) => (
                                                                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group/bar relative">
                                                                    <div
                                                                        className={cn(
                                                                            "w-full rounded-sm transition-all",
                                                                            iter.improved ? "bg-[#121212]" : "bg-[#E5E5E5]"
                                                                        )}
                                                                        style={{ height: `${Math.max(iter.metrics.composite * 100, 10)}%` }}
                                                                    />
                                                                    <span className="text-[10px] text-[#78716c] font-mono">{idx + 1}</span>

                                                                    {/* Tooltip */}
                                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover/bar:opacity-100 whitespace-nowrap pointer-events-none z-10">
                                                                        {(iter.metrics.composite * 100).toFixed(1)}%
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="h-24 flex items-center justify-center text-sm text-[#78716c] italic">
                                                            No iteration history
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
