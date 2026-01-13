"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/core/db/client";
import { Mail, Send, Sparkles, Target, Globe, Brain } from "lucide-react";

export function ScoutShowcase({ jobId }: { jobId: string }) {
    const [scoutedCompanies, setScoutedCompanies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!jobId) return;

        const fetchScoutData = async () => {
            // Find companies involved in this job
            const { data: jobCalls } = await supabase
                .from("ai_calls")
                .select("company_id")
                .eq("job_id", jobId);

            if (!jobCalls) {
                setLoading(false);
                return;
            }

            const companyIds = Array.from(new Set(jobCalls.map(c => c.company_id)));
            if (companyIds.length === 0) {
                setLoading(false);
                return;
            }

            // Fetch leads with populated scout_data
            const { data: scoutedLeads } = await supabase
                .from("leads")
                .select("id, full_name, title, scout_data, relevance_score, company_id, companies(name)")
                .in("company_id", companyIds)
                .not("scout_data", "is", null)
                .limit(1);

            if (scoutedLeads && scoutedLeads.length > 0) {
                setScoutedCompanies(scoutedLeads);
            }
            setLoading(false);
        };

        fetchScoutData();
        const interval = setInterval(fetchScoutData, 5000);
        return () => clearInterval(interval);
    }, [jobId]);

    const handleSendEmail = async () => {
        setSending(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setSending(false);
        alert("Email sent successfully! 🎉");
    };

    if (loading) return null;
    if (scoutedCompanies.length === 0) return null;

    const example = scoutedCompanies[0];

    // Safely extract scout data
    const scoutData = example.scout_data || {};
    const emailDraft = scoutData.email_draft || {};

    const subject = emailDraft.subject || `Automate Your IoT Sales with Throxy's AI Agents`;
    const emailBody = emailDraft.body || "Drafting email content...";

    // Parse markdown-style bold (**text**) into actual bold elements
    const renderFormattedText = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        return lines.map((line, lineIndex) => {
            const parts = line.split(/(\*\*.*?\*\*)/g);
            const formattedLine = parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    const boldText = part.slice(2, -2);
                    return <strong key={i} className="font-semibold text-stone-900">{boldText}</strong>;
                }
                return <span key={i}>{part}</span>;
            });
            return (
                <p key={lineIndex} className="mb-3 last:mb-0">
                    {formattedLine}
                </p>
            );
        });
    };

    return (
        <div className="space-y-8">
            {/* Simple Explanation Header */}
            <div>
                <h2 className="text-xl font-bold text-stone-900 mb-2">Company Scout</h2>
                <p className="text-stone-600 text-sm leading-relaxed max-w-3xl">
                    Company Scout autonomously researches companies, scores decision-makers, and generates personalized outreach emails—no manual work required.
                </p>
            </div>

            {/* Detailed Workflow Diagram */}
            <div className="bg-gradient-to-br from-stone-50 to-stone-100 rounded-xl p-8 border border-stone-200">
                {/* Stage Headers with Arrow Lines */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex-1 text-center">
                        <h3 className="text-base font-bold text-stone-900">Web Research</h3>
                    </div>
                    <div className="flex items-center gap-0 flex-shrink-0 mx-4">
                        <span className="text-stone-400 font-mono tracking-tighter">————</span>
                        <span className="text-stone-400 font-mono">&gt;</span>
                    </div>
                    <div className="flex-1 text-center">
                        <h3 className="text-base font-bold text-stone-900">Lead Scoring</h3>
                    </div>
                    <div className="flex items-center gap-0 flex-shrink-0 mx-4">
                        <span className="text-stone-400 font-mono tracking-tighter">————</span>
                        <span className="text-stone-400 font-mono">&gt;</span>
                    </div>
                    <div className="flex-1 text-center">
                        <h3 className="text-base font-bold text-stone-900">Ready to Send</h3>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-6 items-start">
                    {/* Stage 1: Web Research */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-stone-200 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                <Globe className="w-4 h-4 text-purple-600" />
                            </div>
                            <span className="text-sm font-medium text-stone-700">Company website scraping</span>
                        </div>
                        <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-stone-200 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-stone-700">Product analysis</span>
                        </div>
                        <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-stone-200 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-stone-700">Business challenges ID</span>
                        </div>
                    </div>

                    {/* Connector 1 */}
                    <div className="flex items-center justify-center h-full pt-8">
                        <div className="flex items-center gap-0">
                            <span className="text-stone-300 font-mono tracking-tighter">————</span>
                            <span className="text-stone-300 font-mono">&gt;</span>
                        </div>
                    </div>

                    {/* Stage 2: Lead Scoring */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-stone-200 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                <Target className="w-4 h-4 text-purple-600" />
                            </div>
                            <span className="text-sm font-medium text-stone-700">ICP matching</span>
                        </div>
                        <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-stone-200 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-stone-700">Decision-maker ranking</span>
                        </div>
                        <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-stone-200 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-stone-700">Relevance scoring</span>
                        </div>
                    </div>

                    {/* Connector 2 */}
                    <div className="flex items-center justify-center h-full pt-8">
                        <div className="flex items-center gap-0">
                            <span className="text-stone-300 font-mono tracking-tighter">————</span>
                            <span className="text-stone-300 font-mono">&gt;</span>
                        </div>
                    </div>

                    {/* Stage 3: Result Card - Light Theme */}
                    <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-sm">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="text-stone-900 font-bold text-sm">{example.full_name}</div>
                            </div>
                            <div className="text-stone-600 text-xs font-medium">
                                SCORE {example.relevance_score}/100
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 text-stone-500">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span className="uppercase tracking-wide">{example.title}</span>
                                </div>
                                <span className="text-purple-600 uppercase tracking-wide font-medium">PERSONA</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 text-stone-500">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <span className="uppercase tracking-wide">{example.companies?.name}</span>
                                </div>
                                <span className="text-stone-400 uppercase tracking-wide font-medium">ICP</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 text-stone-500">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span className="uppercase tracking-wide">Email ready</span>
                                </div>
                                <span className="text-green-600 uppercase tracking-wide font-medium">DRAFTED</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gmail-Style Email Card */}
            <div className="bg-white rounded-lg overflow-hidden shadow-lg border border-stone-200">
                {/* Email Header - Gmail Style */}
                <div className="bg-gradient-to-b from-stone-50 to-white border-b border-stone-200 px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-100 rounded-lg p-2">
                                <Mail className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-stone-900">AI-Generated Outreach</h3>
                                <p className="text-xs text-stone-500">Draft ready to send</p>
                            </div>
                        </div>
                        <div className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-purple-200">
                            Relevance Score: {example.relevance_score}/100
                        </div>
                    </div>

                    {/* Target Contact Badge - No Avatar */}
                    <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
                        <div className="space-y-0.5">
                            <div className="text-base font-bold text-stone-900">{example.full_name}</div>
                            <div className="text-purple-600 font-medium text-sm">{example.title}</div>
                            <div className="text-stone-500 text-xs">{example.companies?.name}</div>
                        </div>
                    </div>
                </div>

                {/* Email Fields - Gmail Style */}
                <div className="px-6 py-4 bg-white border-b border-stone-200">
                    <div className="space-y-3">
                        <div className="flex items-baseline gap-3 text-sm">
                            <span className="text-stone-500 font-medium w-16 flex-shrink-0">From:</span>
                            <span className="text-stone-700">your-sales@company.com</span>
                        </div>
                        <div className="flex items-baseline gap-3 text-sm">
                            <span className="text-stone-500 font-medium w-16 flex-shrink-0">To:</span>
                            <span className="text-stone-700">{example.full_name.toLowerCase().replace(' ', '.')}@{example.companies?.name.toLowerCase().replace(/\s+/g, '')}.com</span>
                        </div>
                        <div className="flex items-baseline gap-3 text-sm">
                            <span className="text-stone-500 font-medium w-16 flex-shrink-0">Subject:</span>
                            <span className="text-stone-900 font-semibold">{subject}</span>
                        </div>
                    </div>
                </div>

                {/* Email Body - Gmail Style */}
                <div className="px-6 py-6 bg-white">
                    <div className="text-stone-700 text-[15px] leading-relaxed font-normal space-y-4">
                        {renderFormattedText(emailBody)}
                    </div>
                </div>

                {/* Footer Actions - Gmail Style */}
                <div className="bg-stone-50 border-t border-stone-200 px-6 py-4 flex items-center justify-between">
                    <div className="text-xs text-stone-500 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                        <span>AI-generated • Based on live web research of {example.companies?.name}</span>
                    </div>
                    <button
                        onClick={handleSendEmail}
                        disabled={sending}
                        className="bg-[#D0C3FC] hover:bg-[#BEAEFA] disabled:bg-stone-300 disabled:text-stone-500 text-purple-900 font-semibold px-6 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 group shadow-sm hover:shadow-md"
                    >
                        {sending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-purple-900 border-t-transparent rounded-full animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                Send Email
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
