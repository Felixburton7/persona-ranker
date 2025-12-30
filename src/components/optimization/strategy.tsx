import { BrainCircuit, LineChart, Target, Scale, Zap } from "lucide-react";

export function OptimizationStrategy() {
    return (
        <div className="h-full flex flex-col gap-6">
            <div className="bg-white border border-[#E5E5E5] p-6 rounded-xl shadow-sm flex-1">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-[#E3DDF7] rounded-lg flex items-center justify-center">
                        <BrainCircuit className="w-5 h-5 text-[#5B21B6]" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[#121212]">Optimization Strategy</h3>
                        <p className="text-xs text-[#78716c]">Automated prompt engineering logic</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Strategy 1 */}
                    <div className="group">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center shrink-0 group-hover:bg-[#E3DDF7] transition-colors">
                                <LineChart className="w-4 h-4 text-purple-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-[#121212] mb-1">Textual Gradient Descent</h4>
                                <p className="text-sm text-[#78716c] leading-relaxed">
                                    Instead of random trial & error, the system calculates a <span className="text-[#5B21B6] font-medium">"semantic gradient"</span> — identifying specific directions in language space to reduce ranking errors.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Strategy 2 */}
                    <div className="group">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                                <Target className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-[#121212] mb-1">Few-Shot Error Correction</h4>
                                <p className="text-sm text-[#78716c] leading-relaxed">
                                    The optimizer identifies <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-xs font-medium">false positives</span> and <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-xs font-medium">false negatives</span> to generate precise "negative constraints" and "positive reinforcements."
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Strategy 3 */}
                    <div className="group">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                                <Scale className="w-4 h-4 text-amber-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-[#121212] mb-1">Composite Score Maximization</h4>
                                <p className="text-sm text-[#78716c] leading-relaxed">
                                    We optimize for a weighted metric: <code className="bg-[#F5F5F5] px-1.5 rounded text-xs border border-[#E5E5E5]">0.4 * F1</code> + <code className="bg-[#F5F5F5] px-1.5 rounded text-xs border border-[#E5E5E5]">0.6 * NDCG@3</code>. This ensures we maximize both relevance and ranking order.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Model Config Card */}
            <div className="bg-[#121212] rounded-xl p-5 shadow-lg flex items-center justify-between text-white relative overflow-hidden group">
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                        <Zap className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                        <p className="text-xs text-white/60 mb-0.5 uppercase tracking-wider font-medium">Optimizer Engine</p>
                        <p className="font-bold text-lg">Gemini 2.0 Flash</p>
                    </div>
                </div>

                {/* Decorative background element */}
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-purple-600/20 to-transparent group-hover:from-purple-600/30 transition-all duration-500" />
            </div>
        </div>
    );
}
