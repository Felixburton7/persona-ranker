"use client";

import Link from "next/link";
import { Layers, Zap, Database, Brain, Network, CheckCircle2, FileSpreadsheet, ArrowDown, X, Check, Search, GitGraph, Mail } from "lucide-react";

const STEPS = [
    {
        id: 1,
        title: "CSV Ingestion & Normalization",
        description: "Upload your lead database as a CSV file. The system automatically ingests data, normalizes company names, titles, and employee ranges, then deduplicates using canonical keys to prevent double-processing.",
        tech: "Next.js + Supabase",
        logo: (
            <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
                <path d="M11.572 0c-.176 0-.31.001-.358.007a19.76 19.76 0 0 1-.364.033C7.443.346 4.25 2.185 2.228 5.012a11.875 11.875 0 0 0-2.119 5.243c-.096.659-.108.854-.108 1.747s.012 1.089.108 1.748c.652 4.506 3.86 8.292 8.209 9.695.779.25 1.6.422 2.534.525.363.04 1.935.04 2.299 0 1.611-.178 2.977-.577 4.323-1.264.207-.106.247-.134.219-.158-.02-.013-.9-1.193-1.955-2.62l-1.919-2.592-2.404-3.558a338.739 338.739 0 0 0-2.422-3.556c-.009-.002-.018 1.579-.023 3.51-.007 3.38-.01 3.515-.052 3.595a.426.426 0 0 1-.206.214c-.075.037-.14.044-.495.044H7.81l-.108-.068a.438.438 0 0 1-.157-.171l-.05-.106.006-4.703.007-4.705.072-.092a.645.645 0 0 1 .174-.143c.096-.047.134-.051.54-.051.478 0 .558.018.682.154.035.038 1.337 1.999 2.895 4.361a10760.433 10760.433 0 0 0 4.735 7.17l1.9 2.879.096-.063a12.317 12.317 0 0 0 2.466-2.163 11.944 11.944 0 0 0 2.824-6.134c.096-.66.108-.854.108-1.748 0-.893-.012-1.088-.108-1.747-.652-4.506-3.859-8.292-8.208-9.695a12.597 12.597 0 0 0-2.499-.523A33.119 33.119 0 0 0 11.573 0zm4.069 7.217c.347 0 .408.005.486.047a.473.473 0 0 1 .237.277c.018.06.023 1.365.018 4.304l-.006 4.218-.744-1.14-.746-1.14v-3.066c0-1.982.01-3.097.023-3.15a.478.478 0 0 1 .233-.296c.096-.05.13-.054.5-.054z" />
            </svg>
        ),
    },
    {
        id: 2,
        title: "Company Batching & Context Enrichment",
        description: "Leads are grouped by company and enriched with web intelligence. The Scout Agent scrapes company websites to extract signals like funding announcements, hiring patterns, and go-to-market strategies.",
        tech: "Trigger.dev + Cheerio",
        logo: (
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
        ),
    },
    {
        id: 3,
        title: "Deterministic Pre-filtering",
        description: "Before ranking, a rules-based gate excludes obvious non-targets: HR, Finance, Legal, Advisors, and Interns. Dynamic exceptions apply based on company size (e.g., CTOs allowed at startups under 10 employees).",
        tech: "TypeScript + Zod",
        logo: (
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
        ),
    },
    {
        id: 4,
        title: "Multi-Model LLM Ranking",
        description: "The system defaults to Gemini Flash for industry-leading speed and accuracy. Users can also select any model from the Groq API to optimize for specific latency or reasoning requirements.",
        tech: "Gemini (Default) + Groq",
        logo: (
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#F97316" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
            </svg>
        ),
    },
    {
        id: 5,
        title: "Persona-Aware Scoring",
        description: "The LLM evaluates each lead against a detailed persona rubric (department fit, seniority fit, size context fit). It classifies roles as decision_maker, champion, or irrelevant and assigns explicit ranks within each company.",
        tech: "LLM + Structured JSON",
        logo: (
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#8B5CF6" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
        ),
    },
    {
        id: 6,
        title: "Batch Database Persistence",
        description: "All rankings, scores, reasoning, and rubric data are persisted to Supabase in batch operations. Progress updates trigger real-time UI changes via Supabase Realtime subscriptions.",
        tech: "Supabase Realtime",
        logo: (
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#10B981" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
        ),
    },
    {
        id: 7,
        title: "Live Leaderboard & Export",
        description: "As leads are ranked, they stream into an animated leaderboard with expandable rows showing AI reasoning. Export your top N leads per company to CSV for immediate outreach.",
        tech: "React Table + CSV Export",
        logo: (
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#6B7280" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
        ),
    },
    {
        id: 8,
        title: "Automatic Prompt Optimization",
        description: "The system uses AI to optimize its own prompts. It evaluates performance on a pre-ranked eval set, generates natural language gradients from errors, and iteratively refines the prompt to improve F1 score and ranking accuracy.",
        tech: "APO/ProTeGi Algorithm",
        logo: (
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#EC4899" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6m0 6v6m5.5-11.5L13 12l4.5 4.5M6.5 6.5L11 11l-4.5 4.5M1 12h6m6 0h6" />
            </svg>
        ),
    },
];

export default function DocsPage() {
    return (
        <div className="min-h-screen bg-[#F9F8F4] text-[#121212] flex flex-col font-sans antialiased selection:bg-purple-100 selection:text-purple-900">
            {/* Navigation */}
            <nav className="max-w-[1400px] mx-auto w-full px-6 py-6">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
                        <div className="w-8 h-8 bg-black text-white flex items-center justify-center rounded-sm">
                            <Layers size={16} strokeWidth={3} />
                        </div>
                        <span className="text-[#1A1A1A]">
                            lead
                            <span className="text-gray-400 font-light">.ranker</span>
                        </span>
                    </Link>

                    {/* Nav Links */}
                    <div className="hidden md:flex gap-6 text-sm font-medium text-gray-500">
                        <Link href="/docs" className="hover:text-black cursor-pointer transition-colors">
                            Documentation
                        </Link>
                        <Link href="/optimization" className="hover:text-black cursor-pointer transition-colors">
                            Prompt Optimization
                        </Link>
                        <Link href="/" className="hover:text-black cursor-pointer transition-colors">
                            Launch App
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 w-full">
                {/* Explanation of Choices Section - Wider Container */}
                <div className="max-w-[1200px] mx-auto px-6 pt-16 mb-20">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#E5E5E5] bg-white mb-8">
                        <div className="w-2 h-2 rounded-full bg-[#B4F7C3] animate-pulse" />
                        <span className="text-xs font-mono uppercase tracking-wider text-[#78716c]">Design Rationale</span>
                    </div>

                    <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1] text-[#1A1A1A]">
                        Explanation of<br />
                        <span className="relative inline-block">
                            Choices
                            <svg className="absolute -bottom-2 left-0 w-full h-3 text-[#D0C3FC]" viewBox="0 0 100 10" preserveAspectRatio="none">
                                <path d="M0 5 Q50 10 100 5" stroke="currentColor" strokeWidth="3" fill="none" />
                            </svg>
                        </span>
                    </h2>

                    <p className="text-xl text-[#78716c] max-w-5xl leading-relaxed mb-16">
                        Here's the architecture and decisions I made, hope they make sense! For the ranking, I chose to <span className="text-[#1A1A1A] font-medium">filter and then batch candidates by company</span> rather than scoring individually. This lets the model compare peers directly to find the true decision-makers, balancing <span className="text-[#1A1A1A] font-medium">contextual accuracy</span> with <span className="text-[#1A1A1A] font-medium">token costs</span>. For the prompt optimization, I implemented a <span className="text-[#1A1A1A] font-medium">size-aware subsampling</span> strategy—optimizing against a diverse subset of companies to prevent overfitting while keeping the feedback loop fast.
                    </p>

                    {/* Choice Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Choice 1: Persona-Driven */}
                        <div className="space-y-4 p-6 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-xl group">
                            <div className="w-12 h-12 bg-[#F9F8F4] rounded-xl flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                                <Brain size={24} strokeWidth={2} />
                            </div>
                            <h3 className="text-xl font-bold text-[#1A1A1A]">Persona-Driven Ranking Strategy</h3>
                            <p className="text-[#78716c] leading-relaxed">
                                I built the rubric to adapt based on company size. At a 10-person startup, the CEO is your buyer. At a 500-person company, you're looking for the VP of Sales Development instead.
                            </p>
                            <p className="text-sm font-mono text-[#78716c] bg-[#F5F5F5] p-3 rounded-lg border border-[#E5E5E5]">
                                I score on department_fit, seniority_fit, & size_fit, then assign explicit ranks (1, 2, 3...). No ties allowed.
                            </p>
                        </div>

                        {/* Choice 2: Gemini & Groq */}
                        <div className="space-y-4 p-6 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-xl group">
                            <div className="w-12 h-12 bg-[#F9F8F4] rounded-xl flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                                <Zap size={24} strokeWidth={2} />
                            </div>
                            <h3 className="text-xl font-bold text-[#1A1A1A]">Gemini & Groq Support</h3>
                            <p className="text-[#78716c] leading-relaxed">
                                I set Gemini as the default because it's <span className="text-[#121212] font-semibold">fast, reliable, and highly cost-effective</span>. For flexibility, you can swap to any model on the Groq API to handle specific scale or latency requirements.
                            </p>
                        </div>

                        {/* Choice 3: Company Batching */}
                        <div className="space-y-4 p-6 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-xl group">
                            <div className="w-12 h-12 bg-[#F9F8F4] rounded-xl flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                                <Brain size={24} strokeWidth={2} />
                            </div>
                            <h3 className="text-xl font-bold text-[#1A1A1A]">Company-Batched Ranking</h3>
                            <p className="text-[#78716c] leading-relaxed">
                                I group leads by company so the LLM can compare them head-to-head. This guarantees I find the <span className="text-[#121212] font-semibold">best N contacts per company</span> with clear, relative rankings.
                            </p>
                        </div>

                        {/* Choice 4: Deterministic Gate */}
                        <div className="space-y-4 p-6 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-xl group">
                            <div className="w-12 h-12 bg-[#F9F8F4] rounded-xl flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                                <CheckCircle2 size={24} strokeWidth={2} />
                            </div>
                            <h3 className="text-xl font-bold text-[#1A1A1A]">Size-Aware Deterministic Gate</h3>
                            <p className="text-[#78716c] leading-relaxed">
                                I filter out HR, Finance, and Legal upfront—<span className="text-[#121212] font-semibold">saving 30-50% of LLM calls</span>. It's context aware too: CTOs pass the gate at startups but get filtered at big enterprises.
                            </p>
                        </div>

                        {/* Choice 5: Async Agent */}
                        <div className="space-y-4 p-6 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-xl group">
                            <div className="w-12 h-12 bg-[#F9F8F4] rounded-xl flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                                <Network size={24} strokeWidth={2} />
                            </div>
                            <h3 className="text-xl font-bold text-[#1A1A1A]">Async Agent Pattern</h3>
                            <p className="text-[#78716c] leading-relaxed">
                                Large lists timeout on Vercel (10-60s limit). I use Trigger.dev to handle this with durable execution and auto-retries. Keeps the UI responsive while the agents work in the background.
                            </p>
                        </div>

                        {/* Choice 6: Realtime */}
                        <div className="space-y-4 p-6 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-xl group">
                            <div className="w-12 h-12 bg-[#F9F8F4] rounded-xl flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                                <Database size={24} strokeWidth={2} />
                            </div>
                            <h3 className="text-xl font-bold text-[#1A1A1A]">Supabase Realtime</h3>
                            <p className="text-[#78716c] leading-relaxed">
                                Supabase streams live updates as companies get processed. You can literally watch the agent work in real-time—no custom WebSockets or polling needed.
                            </p>
                        </div>

                        {/* Choice 7: Batch Upserts */}
                        <div className="space-y-4 p-6 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-xl group md:col-span-2 lg:col-span-3">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="w-12 h-12 bg-[#F9F8F4] rounded-xl flex items-center justify-center shrink-0 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                                    <FileSpreadsheet size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">Batch Upserts Over Row-by-Row</h3>
                                    <p className="text-[#78716c] leading-relaxed">
                                        Writing 50 leads one-by-one means 50 database calls. I do batch upserts instead—<span className="text-[#121212] font-semibold">one atomic transaction</span>. 10x faster and no partial failures.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Line */}
                    <div className="mt-12 p-8 bg-[#E5E5E5]/30 rounded-2xl border border-[#E5E5E5]">
                        <p className="text-lg text-[#1A1A1A] leading-relaxed font-medium">
                            <span className="text-[#78716c] font-normal">Basically:</span> I built this in a few hours. And definitely is not perfect! Hope you like though!
                        </p>
                    </div>
                </div>

                {/* System Architecture - Narrower Container */}
                <div className="max-w-[900px] mx-auto px-6 pb-32">
                    {/* Page Header */}
                    <div className="mb-24 text-center md:text-left">
                        <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border border-purple-100 mb-6 inline-block">
                            System Architecture
                        </span>

                        <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight text-[#1A1A1A]">
                            Inside the <span className="text-gray-400">Engine</span>
                        </h1>

                        <p className="text-base text-gray-500 max-w-2xl leading-relaxed">
                            From raw CSV to ranked intelligence. A breakdown of the autonomous agentic workflow that transforms lead lists into prioritized outreach targets.
                        </p>
                    </div>

                    {/* Timeline Section */}
                    <div className="relative border-l-2 border-gray-100 ml-4 md:ml-6 space-y-16">
                        {STEPS.map((step) => (
                            <div key={step.id} className="relative pl-12 md:pl-16 pr-4 group">
                                {/* Timeline Node */}
                                <div className="absolute -left-[11px] top-2 w-6 h-6 rounded-full bg-white border-4 border-gray-200 group-hover:border-black group-hover:scale-110 transition-all duration-300 z-10 shadow-sm"></div>

                                {/* Step Content */}
                                <div className="flex flex-col md:flex-row gap-8 items-start">
                                    {/* Text Content */}
                                    <div className="flex-1 pt-1">
                                        {/* Title & Number */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <h3 className="text-xl font-bold text-[#1A1A1A]">{step.title}</h3>
                                            <span className="hidden md:inline-block h-px w-10 bg-gray-100"></span>
                                            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest border border-gray-100 px-2 py-0.5 rounded">
                                                {step.id === 8 ? "Additional" : `Step ${String(step.id).padStart(2, "0")}`}
                                            </span>
                                        </div>

                                        {/* Description */}
                                        <p className="text-gray-500 leading-relaxed text-base mb-6 max-w-lg">
                                            {step.description}
                                        </p>
                                    </div>

                                    {/* Technology Card */}
                                    <div className="w-full md:w-64 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-xl transition-shadow duration-300">
                                        {/* Header Row */}
                                        <div className="flex items-center justify-between mb-4">
                                            {/* Logo Container */}
                                            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-[#1A1A1A]">
                                                {step.logo}
                                            </div>

                                            {/* Status Indicator */}
                                            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
                                        </div>

                                        {/* Label */}
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                                            Technology
                                        </div>

                                        {/* Tech Name */}
                                        <div className="font-medium text-[#1A1A1A]">{step.tech}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Funnel Section */}
            <section className="border-t border-gray-100 bg-white py-32">
                <div className="max-w-[1000px] mx-auto px-6">
                    <div className="mb-12 text-center">
                        <h2 className="text-4xl md:text-5xl font-bold text-[#1A1A1A] mb-4 tracking-tight">It basically does this</h2>
                        <p className="text-gray-500 text-lg">From raw spreadsheet to prioritized inbox.</p>
                    </div>

                    <div className="max-w-3xl mx-auto space-y-8">

                        {/* 1. INPUT: Raw Data Visualization */}
                        <div className="relative group z-30">
                            {/* Card Body */}
                            <div className="relative bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                {/* Header */}
                                <div className="bg-gray-50/50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="text-gray-400">
                                            <FileSpreadsheet size={18} />
                                        </div>
                                        <span className="font-semibold text-sm text-gray-900 tracking-wide">Raw Data</span>
                                    </div>
                                    <div className="text-xs font-mono text-gray-400">leads.csv</div>
                                </div>
                                {/* Content */}
                                <div className="p-6 font-mono text-xs md:text-sm overflow-x-auto">
                                    <div className="grid grid-cols-4 gap-8 text-gray-400 border-b border-gray-100 pb-3 mb-3 min-w-[500px] uppercase tracking-wider text-[10px]">
                                        <div>Name</div>
                                        <div>Title</div>
                                        <div>Company</div>
                                        <div className="text-right">Size</div>
                                    </div>
                                    <div className="space-y-3 min-w-[500px]">
                                        <div className="grid grid-cols-4 gap-8 text-gray-400 items-center">
                                            <div className="font-medium text-gray-500">J. Smith</div>
                                            <div>Recruiter</div>
                                            <div>Acme Corp</div>
                                            <div className="text-right">5000+</div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-8 text-[#1A1A1A] items-center bg-gray-50 -mx-4 px-4 py-2 rounded-lg border border-gray-100">
                                            <div className="font-bold">A. Chen</div>
                                            <div className="font-medium">CTO</div>
                                            <div>Nexus AI</div>
                                            <div className="text-right">12</div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-8 text-gray-400 items-center">
                                            <div className="font-medium text-gray-500">B. Davis</div>
                                            <div>Intern</div>
                                            <div>Nexus AI</div>
                                            <div className="text-right">12</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Down Arrow */}
                        <div className="flex justify-center relative z-40">
                            <div className="bg-white border border-gray-200 p-2 rounded-full shadow-sm text-gray-300">
                                <ArrowDown size={16} />
                            </div>
                        </div>

                        {/* 2. PROCESS: The Filter/Rank */}
                        <div className="w-[90%] mx-auto relative group z-20">
                            <div className="relative bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                <div className="bg-gray-50/50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="text-gray-400">
                                            <Brain size={18} />
                                        </div>
                                        <span className="font-semibold text-sm text-gray-900 tracking-wide">Ranking Logic</span>
                                    </div>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Box 1 (Discard) */}
                                    <div className="bg-white rounded-lg p-4 border border-gray-100 opacity-60 grayscale">
                                        <div className="flex items-start justify-between mb-3">
                                            <span className="font-medium text-gray-500 text-sm">J. Smith</span>
                                            <span className="text-gray-500 text-[10px] uppercase border border-gray-200 px-1.5 py-0.5 rounded font-medium">Discard</span>
                                        </div>
                                        <div className="text-[11px] text-gray-400 font-mono leading-relaxed space-y-1">
                                            <div className="flex items-center gap-2">
                                                <X size={10} />
                                                <span>Title Match: 'Recruiter'</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <X size={10} />
                                                <span>Department: HR</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Box 2 (Match) */}
                                    <div className="bg-white rounded-lg p-4 border border-[#1A1A1A] shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-gray-50 to-white -z-10 rounded-bl-3xl"></div>
                                        <div className="flex items-start justify-between mb-3">
                                            <span className="font-bold text-[#1A1A1A] text-sm">A. Chen</span>
                                            <span className="text-[#1A1A1A] text-[10px] uppercase border border-[#1A1A1A] px-1.5 py-0.5 rounded font-bold">Match</span>
                                        </div>
                                        <div className="text-[11px] text-gray-600 font-mono leading-relaxed space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Check size={10} className="text-[#1A1A1A]" strokeWidth={3} />
                                                <span>Role: Tech Decision Maker</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Check size={10} className="text-[#1A1A1A]" strokeWidth={3} />
                                                <span>Context: Small Team</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* Down Arrow */}
                        <div className="flex justify-center relative z-40">
                            <div className="bg-white border border-gray-200 p-2 rounded-full shadow-sm text-gray-300">
                                <ArrowDown size={16} />
                            </div>
                        </div>

                        {/* 3. OUTPUT: The Result */}
                        <div className="w-[80%] mx-auto relative group z-0">
                            <div className="relative bg-[#1A1A1A] text-white border border-gray-900 rounded-xl overflow-hidden shadow-xl hover:shadow-2xl transition-all">
                                {/* Purple Glow */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 blur-[80px] rounded-full pointer-events-none -mt-32 -mr-32"></div>

                                <div className="bg-white/5 border-b border-white/10 px-6 py-4 flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="text-purple-400">
                                            <Zap size={18} className="fill-purple-400/20" />
                                        </div>
                                        <span className="font-semibold text-sm text-white tracking-wide">High Signal Leads</span>
                                    </div>
                                </div>
                                <div className="p-6 relative z-10">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 bg-white text-black rounded-xl flex items-center justify-center font-bold text-xl shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                                                1
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg leading-tight mb-1">Alex Chen</div>
                                                <div className="text-white/40 text-sm font-light">CTO • Nexus AI</div>
                                            </div>
                                        </div>
                                        <div className="hidden sm:block">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-xs font-medium cursor-pointer text-white/60 hover:text-white">
                                                <span>View Analysis</span>
                                                <ArrowDown size={12} className="-rotate-90" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Items */}
                                    <div className="grid grid-cols-3 gap-3 pt-6 border-t border-white/10">
                                        <div className="flex items-center gap-2 text-[10px] text-white/50 uppercase tracking-wider font-mono">
                                            <Search size={12} className="text-purple-400" />
                                            <span>Company Scouted</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-white/50 uppercase tracking-wider font-mono">
                                            <GitGraph size={12} className="text-purple-400" />
                                            <span>Hierarchy Mapped</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-white/50 uppercase tracking-wider font-mono">
                                            <Mail size={12} className="text-purple-400" />
                                            <span>Email Generated</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Bottom CTA */}
            <div className="max-w-[900px] mx-auto px-6 mb-20">
                <div className="p-12 bg-gray-50 rounded-3xl text-center border border-gray-100">
                    <h3 className="text-xl font-bold mb-4">Ready to see it in action?</h3>

                    <p className="text-sm text-gray-500 mb-8">
                        Upload your lead CSV and watch the autonomous ranking system in real-time.
                    </p>

                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-[#1A1A1A] text-white font-bold rounded-xl hover:scale-105 transition-transform"
                    >
                        <Zap size={20} />
                        Launch Ranker
                    </Link>
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-gray-100 py-8">
                <div className="max-w-[1400px] mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                            <Layers size={16} />
                            <span>
                                lead<span className="text-gray-300">.ranker</span>
                            </span>
                        </div>
                        <div className="flex gap-6">
                            <span>Powered by Gemini + Groq + Trigger.dev</span>
                            <span>•</span>
                            <span>Built with Next.js</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
