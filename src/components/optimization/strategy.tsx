import { Search } from "lucide-react";

interface OptimizationStrategyProps {
    isOptimizing?: boolean;
}

export function OptimizationStrategy({ isOptimizing = false }: OptimizationStrategyProps) {
    // Dynamic Styles based on state
    const highlightClass = isOptimizing
        ? "bg-purple-100 text-purple-800 border-purple-200"
        : "bg-[#F5F5F5] text-[#121212] border-[#E5E5E5]";

    const cardBorderClass = isOptimizing
        ? "border-purple-200 shadow-lg shadow-purple-500/5 ring-1 ring-purple-100"
        : "border-[#E5E5E5] shadow-sm";

    return (
        <div className={`bg-white border p-6 rounded-xl h-full transition-all duration-500 ${cardBorderClass}`}>
            <div className="flex items-center gap-2 mb-6 border-b border-[#E5E5E5] pb-4">
                {isOptimizing ? (
                    <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center animate-pulse">
                        <div className="w-2 h-2 bg-purple-600 rounded-full" />
                    </div>
                ) : (
                    <Search className="w-4 h-4 text-[#121212]" />
                )}

                {isOptimizing ? (
                    <h3 className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded uppercase tracking-wider">
                        Active Strategy
                    </h3>
                ) : (
                    <h3 className="text-xs font-bold text-[#121212] uppercase tracking-wider">
                        Optimization Strategy
                    </h3>
                )}
            </div>

            <div className="space-y-8">
                <div>
                    <h4 className={`font-bold text-sm mb-2 transition-colors ${isOptimizing ? 'text-purple-900' : 'text-[#121212]'}`}>
                        Objective
                    </h4>
                    <p className="text-sm text-[#78716c] leading-relaxed">
                        Maximizing <span className={`px-1.5 py-0.5 rounded font-medium border transition-colors duration-500 ${highlightClass}`}>F1-Score</span> (Relevance) and <span className={`px-1.5 py-0.5 rounded font-medium border transition-colors duration-500 ${highlightClass}`}>NDCG@3</span> (Ranking Accuracy) on a held-out evaluation set of 50+ labelled leads.
                    </p>
                </div>

                <div>
                    <h4 className={`font-bold text-sm mb-2 transition-colors ${isOptimizing ? 'text-purple-900' : 'text-[#121212]'}`}>
                        Methodology
                    </h4>
                    <p className="text-sm text-[#78716c] leading-relaxed">
                        Using <span className={`px-1.5 py-0.5 rounded font-medium border transition-colors duration-500 ${highlightClass}`}>Textual Gradient Descent</span>. The system identifies specific cases where the prompt failed, generates a "critique", and rewrites instructions to fix edge cases without breaking existing behavior.
                    </p>
                </div>
            </div>
        </div>
    );
}

