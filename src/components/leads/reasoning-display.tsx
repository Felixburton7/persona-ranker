"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Building2, User, Target, Sparkles, Filter } from "lucide-react"
import { Lead } from "@/types/leads"
import { getScoreColor } from "@/core/leads-styling"

interface ReasoningDisplayProps {
    lead: Lead & { rubric_scores?: { department_fit: number; seniority_fit: number; size_fit: number } }
}

export function ReasoningDisplay({ lead }: ReasoningDisplayProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    // Parse rubric if it exists, otherwise default
    const rubric = lead.rubric_scores || { department_fit: 0, seniority_fit: 0, size_fit: 0 }

    // Determine status colors based on score
    const scoreColor = getScoreColor(lead.relevance_score);

    const isRanked = lead.rank_within_company != null;

    return (
        <div className="w-full">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-xs font-medium text-stone-500 hover:text-purple-600 transition-colors mb-4 group"
            >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Sparkles size={14} className="group-hover:text-purple-500" />
                View Logic Flow (Funnel)
            </button>

            {isExpanded && (
                <div className="relative flex flex-col items-center gap-2 animate-in slide-in-from-top-2 duration-300">

                    {/* LAYER 1: INPUTS (Wide) */}
                    <div className="w-full max-w-2xl bg-white border border-stone-200 rounded-lg shadow-sm p-4 relative group hover:border-purple-200 transition-colors">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-stone-100 px-2 py-0.5 rounded-full text-[10px] font-bold text-stone-500 uppercase tracking-wider border border-stone-200">
                            Context Input
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-start gap-3">
                                <Building2 className="w-4 h-4 text-stone-400 mt-1" />
                                <div>
                                    <div className="text-xs font-bold text-stone-700 uppercase">Company</div>
                                    <div className="text-sm font-medium text-stone-900">{lead.company_name}</div>
                                    <div className="text-xs text-stone-500">{lead.company_size || "Unknown Size"}</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <User className="w-4 h-4 text-stone-400 mt-1" />
                                <div>
                                    <div className="text-xs font-bold text-stone-700 uppercase">Candidate</div>
                                    <div className="text-sm font-medium text-stone-900">{lead.full_name}</div>
                                    <div className="text-xs text-purple-600 font-mono">{lead.title}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Arrow Down */}
                    <div className="text-stone-300">
                        <ChevronDown />
                    </div>

                    {/* LAYER 2: FILTER & LOGIC (Medium) */}
                    <div className="w-full max-w-lg bg-stone-50/50 border border-stone-200 rounded-lg p-4 relative hover:border-purple-200 transition-colors">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 py-0.5 rounded-full text-[10px] font-bold text-stone-500 uppercase tracking-wider border border-stone-200 shadow-sm flex items-center gap-1">
                            <Filter size={10} />
                            Logic Center
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center divide-x divide-stone-200">
                            <div className="px-2">
                                <div className="text-[10px] text-stone-400 uppercase mb-1">Dept Fit</div>
                                <div className="flex justify-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className={`w-1.5 h-6 rounded-full ${i <= (rubric.department_fit || 0) ? 'bg-purple-500' : 'bg-stone-200'}`} />
                                    ))}
                                </div>
                            </div>
                            <div className="px-2">
                                <div className="text-[10px] text-stone-400 uppercase mb-1">Seniority</div>
                                <div className="flex justify-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className={`w-1.5 h-6 rounded-full ${i <= (rubric.seniority_fit || 0) ? 'bg-blue-500' : 'bg-stone-200'}`} />
                                    ))}
                                </div>
                            </div>
                            <div className="px-2">
                                <div className="text-[10px] text-stone-400 uppercase mb-1">Size Match</div>
                                <div className="flex justify-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className={`w-1.5 h-6 rounded-full ${i <= (rubric.size_fit || 0) ? 'bg-emerald-500' : 'bg-stone-200'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {lead.reasoning && (
                            <div className="mt-3 pt-3 border-t border-stone-200 text-xs text-stone-600 italic text-center">
                                "{lead.reasoning}"
                            </div>
                        )}
                    </div>

                    {/* Arrow Down */}
                    <div className="text-stone-300">
                        <ChevronDown />
                    </div>

                    {/* LAYER 3: OUTPUT (Narrow) */}
                    <div className={`w-full max-w-xs rounded-xl shadow-md p-4 text-center border-t-4 relative overflow-hidden ${isRanked ? "bg-white border-green-500" : "bg-stone-50 border-stone-300"
                        }`}>
                        {/* Background Gradient for subtle effect */}
                        {isRanked && <div className="absolute inset-0 bg-green-50/30 -z-10" />}

                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 py-0.5 rounded-full text-[10px] font-bold text-stone-500 uppercase tracking-wider border border-stone-200 shadow-sm flex items-center gap-1">
                            <Target size={10} />
                            Final Output
                        </div>

                        <div className="flex items-center justify-center gap-6 mt-1">
                            <div>
                                <div className="text-[10px] text-stone-400 uppercase mb-1">Score</div>
                                <div className={`text-2xl font-black ${scoreColor}`}>
                                    {lead.relevance_score}<span className="text-sm font-normal text-stone-300">/100</span>
                                </div>
                            </div>

                            <div className="h-8 w-px bg-stone-200" />

                            <div>
                                <div className="text-[10px] text-stone-400 uppercase mb-1">Rank</div>
                                <div className="text-2xl font-black text-stone-900">
                                    {lead.rank_within_company ? `#${lead.rank_within_company}` : "-"}
                                </div>
                            </div>
                        </div>

                        <div className="mt-2 flex justify-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide
                                ${lead.role_type === 'decision_maker' ? 'bg-purple-100 text-purple-700' :
                                    lead.role_type === 'champion' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-600'}
                            `}>
                                {lead.role_type?.replace(/_/g, " ")}
                            </span>
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
