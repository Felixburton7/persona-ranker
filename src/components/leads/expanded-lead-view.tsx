"use client"
import { useState } from "react"
import { AlertTriangle, Info, User, Building2, CheckCircle2, Mail, Code, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReasoningDisplay } from "@/components/leads/reasoning-display"
import { Lead } from "@/types/leads"

export function ExpandedLeadView({ lead }: { lead: Lead }) {
    const [showRaw, setShowRaw] = useState(false)

    return (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-300">
            {/* Header */}
            <div className={`px-6 py-3 border-b flex items-center justify-between ${lead.role_type === 'skipped' ? 'bg-red-50 border-red-100' : 'bg-stone-50/50 border-stone-200'}`}>
                <div className="flex items-center gap-2">
                    <div className={`p-1 rounded-md ${lead.role_type === 'skipped' ? 'bg-red-100' : 'bg-stone-100'}`}>
                        {lead.role_type === 'skipped' ? (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                        ) : (
                            <Info className="w-4 h-4 text-stone-600" />
                        )}
                    </div>
                    <h3 className={`text-sm font-semibold font-sans ${lead.role_type === 'skipped' ? 'text-red-900' : 'text-stone-900'}`}>
                        {lead.role_type === 'skipped' ? 'Processing Error' : 'Company Scout'}
                    </h3>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-stone-400 font-medium uppercase tracking-wider">
                    {lead.role_type === 'skipped' ? (
                        <span className="text-red-500 font-bold">Skipped</span>
                    ) : (
                        <>
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                            Analysis Complete
                        </>
                    )}
                </div>
            </div>

            {/* Funnel Visualization */}
            <div className="px-6 pt-4">
                <ReasoningDisplay lead={lead} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-100">
                {/* Left Column: Target Profile */}
                <div className="p-6 space-y-6">
                    <div>
                        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <User className="w-3.5 h-3.5" />
                            Target Profile
                        </h4>

                        <div className="bg-white rounded-xl border border-stone-100 p-5 shadow-sm space-y-4">
                            <div>
                                <div className="text-xl font-bold text-stone-900 tracking-tight">{lead.full_name || "Unknown Contact"}</div>
                                <div className="text-sm font-medium text-purple-600">{lead.title || "No Title"}</div>
                                <div className="flex items-center gap-1.5 mt-2 text-sm text-stone-500">
                                    <Building2 className="w-3.5 h-3.5" />
                                    {lead.company_name}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-stone-100 grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Relevance</div>
                                    <div className="text-2xl font-bold text-stone-700">{lead.relevance_score}<span className="text-sm text-stone-400 font-normal">/100</span></div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Role Type</div>
                                    <div className="text-sm font-medium text-stone-700 capitalize mt-1.5">
                                        {(lead.role_type || "N/A").replace(/_/g, " ")}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-stone-400 italic flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Selected as top prospect based on relevance signals
                    </div>
                </div>

                {/* Right Column: Outreach Draft / Reasoning */}
                <div className="p-6 bg-stone-50/30">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                            {lead.role_type === 'skipped' ? (
                                <span className="text-red-600 flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Error Details
                                </span>
                            ) : (lead.reasoning || "").includes("Scout Agent Email Draft") ? (
                                <>
                                    <Mail className="w-3.5 h-3.5" />
                                    Autonomous Outreach Draft
                                </>
                            ) : (
                                <>
                                    <Brain className="w-3.5 h-3.5" />
                                    Reasoning Summary
                                </>
                            )}
                        </h4>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] hover:bg-purple-50 text-stone-400 hover:text-purple-600"
                            onClick={() => setShowRaw(!showRaw)}
                        >
                            <Code className="w-3 h-3 mr-1.5" />
                            {showRaw ? "See Draft" : "Context Data"}
                        </Button>
                    </div>

                    <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-sm overflow-auto max-h-[400px]">
                        {showRaw ? (
                            <pre className="text-[10px] font-mono text-stone-600 whitespace-pre-wrap">
                                {JSON.stringify(lead, null, 2)}
                            </pre>
                        ) : (
                            <div className={`prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap font-mono ${lead.role_type === 'skipped' ? 'text-red-600' : 'text-stone-600'}`}>
                                {lead.reasoning ? (
                                    lead.reasoning
                                ) : (
                                    <span className="text-stone-400 italic">No analysis details available.</span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex justify-end">
                        <p className="text-[10px] text-stone-400 italic">
                            *Generated based on analysis of {lead.company_name}*
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
