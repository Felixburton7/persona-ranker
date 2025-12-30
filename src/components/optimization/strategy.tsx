import { Search } from "lucide-react";

export function OptimizationStrategy() {
    return (
        <div className="bg-white border border-[#E5E5E5] p-6 rounded-xl shadow-sm h-full">
            <div className="flex items-center gap-2 mb-6 border-b border-[#E5E5E5] pb-4">
                <Search className="w-4 h-4 text-[#121212]" />
                <h3 className="text-xs font-bold text-[#121212] uppercase tracking-wider">Optimization Strategy</h3>
            </div>

            <div className="space-y-8">
                <div>
                    <h4 className="font-bold text-sm text-[#121212] mb-2">Objective</h4>
                    <p className="text-sm text-[#78716c] leading-relaxed">
                        Maximizing <span className="bg-[#F5F5F5] px-1.5 py-0.5 rounded text-[#121212] font-medium border border-[#E5E5E5]">F1-Score</span> (Relevance) and <span className="bg-[#F5F5F5] px-1.5 py-0.5 rounded text-[#121212] font-medium border border-[#E5E5E5]">NDCG@3</span> (Ranking Accuracy) on a held-out evaluation set of 50+ labelled leads.
                    </p>
                </div>

                <div>
                    <h4 className="font-bold text-sm text-[#121212] mb-2">Methodology</h4>
                    <p className="text-sm text-[#78716c] leading-relaxed">
                        Using <span className="font-medium text-[#121212]">Textual Gradient Descent</span>. The system identifies specific cases where the prompt failed, generates a "critique", and rewrites instructions to fix edge cases without breaking existing behavior.
                    </p>
                </div>
            </div>
        </div>
    );
}

