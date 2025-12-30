import { Activity, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OptimizationHeaderProps {
    onReset: () => void;
}

export function OptimizationHeader({ onReset }: OptimizationHeaderProps) {
    return (
        <div className="mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#E5E5E5] bg-white mb-6">
                <div className="w-2 h-2 rounded-full bg-[#B4F7C3] animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-wider text-[#78716c]">AI-Powered Self-Improvement</span>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
                        Automatic Prompt<br />
                        <span className="relative inline-block">
                            Optimization
                            <svg className="absolute -bottom-2 left-0 w-full h-3 text-[#D0C3FC]" viewBox="0 0 100 10" preserveAspectRatio="none">
                                <path d="M0 5 Q50 10 100 5" stroke="currentColor" strokeWidth="3" fill="none" />
                            </svg>
                        </span>
                    </h1>

                    <p className="text-xl text-[#78716c] max-w-2xl leading-relaxed">
                        Watch AI improve its own lead-ranking instructions. The system <span className="text-[#121212] font-medium">analyzes mistakes</span>,
                        <span className="text-[#121212] font-medium"> learns patterns</span>, and iteratively <span className="text-[#121212] font-medium">refines the prompt</span> for better accuracy.
                    </p>
                </div>
            </div>


        </div>
    );
}
