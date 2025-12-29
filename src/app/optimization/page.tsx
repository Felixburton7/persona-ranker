"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GeminiIcon, GroqIcon } from "@/components/icons";
import {
    Loader2,
    Play,
    CheckCircle2,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Terminal,
    ArrowRight,
    Activity,
    GitBranch,
    Zap,
    Cpu,
    Database,
    Search,
    Upload,
    X,
    RotateCcw,
    Key,
    Eye,
    EyeOff,
    Check,
    Info
} from "lucide-react";
import * as Diff from 'diff';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from "@/lib/utils";

interface OptimizationRun {
    id: string;
    status: "pending" | "running" | "completed" | "failed";
    max_iterations: number;
    iterations_completed: number;
    started_at: string | null;
    completed_at: string | null;
    error_message?: string | null;
    best_prompt?: {
        id: string;
        version: number;
        composite_score: number;
        relevance_f1: number;
        ranking_ndcg_at_3: number;
        prompt_text?: string;
    };
    improvement_history?: Array<{
        iteration: number;
        metrics: {
            precision: number;
            recall: number;
            f1: number;
            ndcgAt3: number;
            composite: number;
        };
        improved: boolean;
        gradient?: {
            summary: string;
            falsePositiveAnalysis: string;
            falseNegativeAnalysis: string;
            rankingMismatchAnalysis: string;
            suggestedImprovements: string[];
            confidenceLevel: string;
        };
    }>;
}

interface PromptVersion {
    id: string;
    version: number;
    prompt_text: string;
    is_active: boolean;
    composite_score: number | null;
    parent_version_id?: string | null;
}

interface SavedApiKey {
    id: string;
    provider: string;
    model_name: string;
    display_name?: string;
}

const SUPPORTED_MODELS = [
    { name: "llama-3.3-70b-versatile", displayName: "Llama 3.3 70B (Versatile)", description: "Balanced - Best for general use", provider: "Meta" },
    { name: "llama-3.1-8b-instant", displayName: "Llama 3.1 8B (Instant)", description: "Fastest - Great for small companies", provider: "Meta" },
    { name: "qwen/qwen3-32b", displayName: "Qwen 3 32B", description: "Efficient - 32B params", provider: "Alibaba" },
    { name: "groq/compound", displayName: "Groq Compound", description: "Groq native", provider: "Groq" },
    { name: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", description: "Google's latest & fastest", provider: "Google" },
    { name: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", description: "Google's most capable", provider: "Google" },
    { name: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", description: "Google's stable model", provider: "Google" },
];

// Rotating messages for evaluation phase
const EVALUATION_MESSAGES = [
    "Running Optimization",
    "Evaluating prompt on test leads...",
    "This is normally the longest bit",
    "Benchmarking against evaluation set...",
    "Running Optimization",
    "Processing evaluation data...",
];

function DiffView({ oldText, newText }: { oldText: string, newText: string }) {
    const diff = Diff.diffWords(oldText, newText);

    return (
        <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {diff.map((part, index) => {
                const color = part.added ? 'bg-green-100 text-green-800' :
                    part.removed ? 'bg-red-100 text-red-800 line-through opacity-70' :
                        'text-[#121212]';
                return (
                    <span key={index} className={color}>
                        {part.value}
                    </span>
                );
            })}
        </div>
    );
}

export default function OptimizationPage() {
    const [runs, setRuns] = useState<OptimizationRun[]>([]);
    const [loading, setLoading] = useState(false);
    const [starting, setStarting] = useState(false);
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const [currentPrompt, setCurrentPrompt] = useState<PromptVersion | null>(null);
    const [previousPromptText, setPreviousPromptText] = useState<string | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [showDiff, setShowDiff] = useState(false);
    const [expandedRun, setExpandedRun] = useState<string | null>(null);
    const [customEvalFile, setCustomEvalFile] = useState<File | null>(null);
    const [showResetModal, setShowResetModal] = useState(false);
    const [showEvalInfo, setShowEvalInfo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Model & API Key Settings
    const [showSettings, setShowSettings] = useState(false);
    const [configMode, setConfigMode] = useState<'default' | 'groq' | 'gemini'>('default');
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [customApiKey, setCustomApiKey] = useState<string>(""); // For Groq
    const [geminiApiKey, setGeminiApiKey] = useState<string>(""); // For Gemini
    const [showApiKey, setShowApiKey] = useState(false);
    const [savedKeys, setSavedKeys] = useState<SavedApiKey[]>([]);
    const [saveKeySuccess, setSaveKeySuccess] = useState(false);
    const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

    useEffect(() => {
        loadRuns();
        loadCurrentPrompt();
        fetchSavedKeys();
    }, []);

    // Use the existing commentary hook for real-time updates
    // It is designed to work with job_id, but optimization runs don't have a standardized job_id in database.
    // However, the optimize-prompt trigger task logs to ai_calls with a null job_id or we can link it if we update schema.
    // For now, let's create a specialized hook or update existing one to handle optimization runs?
    // Actually, simpler: let's query ai_calls with call_type='optimization' or 'gradient' ordered by time.
    const [commentary, setCommentary] = useState<string>("");
    const [rotatingMessageIndex, setRotatingMessageIndex] = useState<number>(0);

    const loadCurrentPrompt = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        const supabaseClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: versions } = await supabaseClient
            .from("prompt_versions")
            .select("*")
            .order("version", { ascending: false });

        if (versions && versions.length > 0) {
            setPromptVersions(versions);
            const active = versions.find(v => v.is_active) || versions[0];
            setCurrentPrompt(active);

            // Find parent to show diff
            if (active.parent_version_id) {
                const parent = versions.find(v => v.id === active.parent_version_id);
                if (parent) {
                    setPreviousPromptText(parent.prompt_text);
                }
            }
        }
        if (!isSilent) setLoading(false);
    };

    // Rotating messages effect for evaluation phase
    useEffect(() => {
        const activeRun = runs.find(r => r.status === "running" || r.status === "pending");
        
        // Only rotate messages when:
        // - There's an active run
        // - First iteration (iterations_completed === 0)
        // - No real-time commentary has been set yet
        const shouldRotate = activeRun && 
                            activeRun.iterations_completed === 0 && 
                            !commentary;
        
        if (!shouldRotate) {
            return;
        }

        // Rotate messages every 3 seconds
        const rotationInterval = setInterval(() => {
            setRotatingMessageIndex((prev) => (prev + 1) % EVALUATION_MESSAGES.length);
        }, 3000);

        return () => {
            clearInterval(rotationInterval);
        };
    }, [runs, commentary]);

    // Poll for commentary and status updates
    useEffect(() => {
        const supabaseClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Subscriptions for real-time updates
        const channel = supabaseClient
            .channel('optimization-updates')
            // Watch for new AI calls during optimization
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "ai_calls",
                },
                (payload) => {
                    const record = payload.new;
                    if (record.call_type === 'gradient') {
                        setCommentary(`Analyzing error patterns and identifying rule weaknesses...`);
                    } else if (record.call_type === 'optimization') {
                        setCommentary(`Running benchmark: Evaluating prompt on test leads...`);
                    } else if (record.call_type === 'eval_progress') {
                        setCommentary(record.model); // Contains "Evaluating: X/Y companies"
                    } else if (record.call_type === 'edit') {
                        setCommentary(`Applying textual gradient descent to refine prompt instructions...`);
                    }
                }
            )
            // Watch for updates to optimization runs
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "optimization_runs",
                },
                () => {
                    loadRuns(true);
                    loadCurrentPrompt(true);
                }
            )
            // Watch for new prompt versions
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "prompt_versions",
                },
                () => {
                    loadCurrentPrompt(true);
                }
            )
            .subscribe();

        // Fallback polling for status updates (handles missed events)
        const interval = setInterval(() => {
            loadRuns(true);
        }, 5000);

        return () => {
            supabaseClient.removeChannel(channel);
            clearInterval(interval);
        };
    }, []); // Removed [runs] to avoid infinite loop


    const loadRuns = async (isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            const res = await fetch("/api/optimization");
            const data = await res.json();

            if (data.runs) {
                setRuns(data.runs);

                // Check if any run is still running
                const runningRun = data.runs.find((r: OptimizationRun) =>
                    r.status === "running" || r.status === "pending"
                );
                setActiveRunId(runningRun?.id || null);

                // If something is running, ensure the prompt is also up to date
                if (runningRun) {
                    loadCurrentPrompt(true);
                }
            }
        } catch (error) {
            console.error("Failed to load runs:", error);
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    const fetchSavedKeys = async () => {
        try {
            const res = await fetch("/api/settings/api-keys");
            if (res.ok) {
                const data = await res.json();
                setSavedKeys(data.keys || []);
            }
        } catch (e) {
            console.error("Failed to fetch API keys:", e);
        }
    };

    const handleSaveApiKey = async () => {
        const isGroq = configMode === 'groq';
        const keyToSave = isGroq ? customApiKey : geminiApiKey;
        const provider = isGroq ? 'groq' : 'gemini';

        if (!keyToSave.trim() || !selectedModel) return;

        try {
            const model = SUPPORTED_MODELS.find(m => m.name === selectedModel);
            const res = await fetch("/api/settings/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: provider,
                    model_name: selectedModel,
                    api_key: keyToSave,
                    base_url: isGroq ? "https://api.groq.com/openai/v1" : "https://generativelanguage.googleapis.com/v1beta/openai/",
                    display_name: model?.displayName || selectedModel
                })
            });

            if (res.ok) {
                await fetchSavedKeys();
                setSaveKeySuccess(true);
                setTimeout(() => setSaveKeySuccess(false), 2000);
            }
        } catch (e) {
            console.error("Failed to save API key:", e);
        }
    };

    const hasKeyForModel = (modelName: string) => {
        return savedKeys.some(k => k.model_name === modelName);
    };

    const startOptimization = async () => {
        try {
            setStarting(true);

            let res: Response;

            if (customEvalFile) {
                // Use FormData for file upload
                const formData = new FormData();
                formData.append("maxIterations", "5");
                formData.append("evalSetCsv", customEvalFile);

                // Add model and API key configuration
                if (configMode !== 'default' && selectedModel) {
                    formData.append("preferredModel", selectedModel);
                }
                if (configMode === 'groq' && customApiKey) {
                    formData.append("apiKey", customApiKey);
                }
                if (configMode === 'gemini' && geminiApiKey) {
                    formData.append("geminiApiKey", geminiApiKey);
                }

                res = await fetch("/api/optimization", {
                    method: "POST",
                    body: formData,
                });
            } else {
                // Use JSON for simple request
                const payload: any = { maxIterations: 5 };

                // Add model and API key configuration
                if (configMode !== 'default' && selectedModel) {
                    payload.preferredModel = selectedModel;
                }
                if (configMode === 'groq' && customApiKey) {
                    payload.apiKey = customApiKey;
                }
                if (configMode === 'gemini' && geminiApiKey) {
                    payload.geminiApiKey = geminiApiKey;
                }

                res = await fetch("/api/optimization", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }

            const data = await res.json();

            if (data.success) {
                setActiveRunId(data.runId);
                setCustomEvalFile(null); // Clear file after starting
                await loadRuns();
            } else {
                alert(`Failed to start: ${data.error}`);
            }
        } catch (error) {
            alert(`Error: ${error}`);
        } finally {
            setStarting(false);
        }
    };

    const confirmReset = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/prompts/reset", {
                method: "POST",
            });
            const data = await res.json();

            if (data.success) {
                setActiveRunId(null); // Clear active run to show form
                await loadCurrentPrompt();
                await loadRuns();
                setShowResetModal(false);
            } else {
                alert(`Failed to reset: ${data.error}`);
            }
        } catch (error) {
            console.error("Error resetting prompt:", error);
            alert("An error occurred while resetting the prompt.");
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.csv')) {
                alert("Please upload a CSV file");
                return;
            }
            setCustomEvalFile(file);
        }
    };

    const formatDuration = (start: string | null, end: string | null) => {
        if (!start) return "—";
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : Date.now();
        const seconds = Math.floor((endTime - startTime) / 1000);

        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    };

    const activeRun = runs.find(r => r.status === "running" || r.status === "pending");
    const completedRuns = runs.filter(r => r.status === "completed" || r.status === "failed");

    return (
        <div className="min-h-screen bg-[#F9F8F4] text-[#121212] font-sans selection:bg-[#D0C3FC] selection:text-[#121212]">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F9F8F4]/80 backdrop-blur-md border-b border-[#E5E5E5]">
                <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-[#121212] text-white flex items-center justify-center rounded-sm transition-transform group-hover:scale-105">
                            <span className="font-bold font-mono text-lg">L</span>
                        </div>
                        <span className="font-bold text-lg tracking-tight">
                            lead.ranker
                        </span>
                    </Link>

                    <div className="hidden md:flex items-center gap-8">
                        <Link href="/docs" className="text-sm font-medium text-[#78716c] hover:text-[#121212] transition-colors">
                            Documentation
                        </Link>
                        <Link href="/optimization" className="text-sm font-medium text-[#121212]">
                            Prompt Optimization
                        </Link>
                        <Link href="/" className="text-sm font-medium text-[#78716c] hover:text-[#121212] transition-colors">
                            Launch App
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-6 max-w-[1200px] mx-auto">
                {/* Rate Limit Error Banner */}
                {activeRun?.status === "failed" && activeRun?.error_message === "rate_limit_exceeded" && (
                    <div className="mb-8 bg-red-50 border-2 border-red-500 rounded-xl p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-start gap-4">
                            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-red-900 mb-2">
                                    ⚠️ AI API Rate Limit Exceeded
                                </h3>
                                <p className="text-red-800 leading-relaxed mb-3">
                                    The optimization process has stopped because all available AI models have reached their rate limits.
                                    This happens when too many requests are made in a short period.
                                </p>
                                <p className="text-sm text-red-700 font-medium">
                                    💡 Solution: Please wait a few minutes before starting a new optimization run, or upgrade your AI provider plan for higher rate limits.
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setActiveRunId(null)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-100"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Hero Section */}
                <div className="mb-20">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#E5E5E5] bg-white mb-6">
                        <div className="w-2 h-2 rounded-full bg-[#B4F7C3] animate-pulse" />
                        <span className="text-xs font-mono uppercase tracking-wider text-[#78716c]">AI-Powered Self-Improvement</span>
                    </div>

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

                {/* Workflow Diagram */}
                <div className="mb-24">
                    <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between border-y border-[#E5E5E5] py-12 relative">
                        {/* Background Grid Pattern */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                            style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                        />

                        {/* Step 1: Evaluate */}
                        <div className="flex-1 relative group">
                            <div className="absolute top-0 left-0 w-full h-full bg-[#F9F8F4] -z-10" />
                            <div className="space-y-3 p-4 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-lg">
                                <div className="w-10 h-10 bg-[#E5E5E5] rounded-lg flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                                    <Database size={20} />
                                </div>
                                <h3 className="font-bold text-lg">Evaluate</h3>
                                <p className="text-sm text-[#78716c]">Run current prompt on 50 test leads</p>
                            </div>
                            <div className="hidden md:block absolute top-[28px] -right-4 w-8 h-[2px] bg-[#E5E5E5]" />
                        </div>

                        {/* Step 2: Analyze */}
                        <div className="flex-1 relative group">
                            <div className="space-y-3 p-4 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-lg">
                                <div className="w-10 h-10 bg-[#E5E5E5] rounded-lg flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                                    <Search size={20} />
                                </div>
                                <h3 className="font-bold text-lg">Analyze Errors</h3>
                                <p className="text-sm text-[#78716c]">Find false positives & negatives</p>
                            </div>
                            <div className="hidden md:block absolute top-[28px] -right-4 w-8 h-[2px] bg-[#E5E5E5]" />
                        </div>

                        {/* Step 3: Generate */}
                        <div className="flex-1 relative group">
                            <div className="space-y-3 p-4 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-lg">
                                <div className="w-10 h-10 bg-[#E5E5E5] rounded-lg flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                                    <Cpu size={20} />
                                </div>
                                <h3 className="font-bold text-lg">Generate Fixes</h3>
                                <p className="text-sm text-[#78716c]">AI suggests prompt improvements</p>
                            </div>
                            <div className="hidden md:block absolute top-[28px] -right-4 w-8 h-[2px] bg-[#E5E5E5]" />
                        </div>

                        {/* Step 4: Apply */}
                        <div className="flex-1 relative group">
                            <div className="space-y-3 p-4 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-lg">
                                <div className="w-10 h-10 bg-[#E5E5E5] rounded-lg flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                                    <Zap size={20} />
                                </div>
                                <h3 className="font-bold text-lg">Apply & Repeat</h3>
                                <p className="text-sm text-[#78716c]">Update prompt, iterate until optimal</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Primary Action Area */}
                {/* Primary Action Area */}
                <div className="grid lg:grid-cols-2 gap-12 mb-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                            <Activity className="w-6 h-6" />
                            Optimization Status
                        </h2>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowResetModal(true)}
                            className="h-8 border-[#E5E5E5] hover:bg-white hover:text-red-600 transition-colors"
                        >
                            <RotateCcw className="w-3 h-3 mr-2" />
                            Start Fresh
                        </Button>
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-12 mb-24">
                    {/* Left: Action / Status */}
                    <div className="border-2 border-[#121212] bg-[#F9F8F4] p-8 rounded-xl relative overflow-hidden h-full">
                        {/* Decorative Background */}
                        <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#D0C3FC] rounded-full blur-[80px] opacity-50" />

                        {activeRun ? (
                            <div className="relative z-10 space-y-8">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm font-medium mb-2">
                                        <span className="flex items-center gap-2">
                                            <span className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                            </span>
                                            {activeRun.status === 'pending' ? 'Booting Optimization' : 'Running Optimization'}
                                        </span>
                                        <span className="font-mono text-[#78716c]">
                                            {formatDuration(activeRun.started_at, null)}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-[#E5E5E5] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#121212] transition-all duration-500 ease-out"
                                            style={{ width: `${Math.max((activeRun.iterations_completed / activeRun.max_iterations) * 100, 5)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs font-mono text-[#78716c] pt-1">
                                        <span>ITERATION {activeRun.iterations_completed + 1}/{activeRun.max_iterations}</span>
                                        <span>{Math.round((activeRun.iterations_completed / activeRun.max_iterations) * 100)}% COMPLETE</span>
                                    </div>
                                </div>

                                <div className="bg-white/60 backdrop-blur-sm border border-[#E5E5E5] p-5 rounded-lg space-y-4">
                                    <div className="font-mono text-xs text-[#78716c] uppercase tracking-wider flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#D0C3FC] animate-pulse" />
                                            Live Activity Log
                                        </div>
                                        {activeRun.improvement_history && activeRun.improvement_history.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                {activeRun.improvement_history.map(iter => (
                                                    <button
                                                        key={iter.iteration}
                                                        onClick={() => {
                                                            const version = promptVersions.find(v => v.version === iter.iteration);
                                                            if (version) {
                                                                setCurrentPrompt(version);
                                                                setSelectedVersionId(version.id);
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
                                                    {(activeRun.improvement_history[activeRun.improvement_history.length - 1].metrics.composite * 100).toFixed(1)}%
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <p className="font-mono text-sm leading-relaxed min-h-[40px]">
                                        <span className="text-[#121212] font-semibold mr-2">{">"}</span> {
                                            commentary || (activeRun.iterations_completed === 0 ? EVALUATION_MESSAGES[rotatingMessageIndex] :
                                                activeRun.iterations_completed >= activeRun.max_iterations ? "Finalizing results & selecting best prompt..." :
                                                    "Applying textual gradient descent to refine instructions...")
                                        }
                                        <span className="animate-pulse">_</span>
                                    </p>

                                    {/* Sub-steps Indicator */}
                                    <div className="pt-4 border-t border-[#E5E5E5] grid grid-cols-4 gap-4">
                                        {[
                                            { label: 'Evaluate', active: (commentary.toLowerCase().includes('evaluating') || (!commentary && activeRun.iterations_completed === 0)) && !commentary.toLowerCase().includes('identifying') },
                                            { label: 'Analyze', active: commentary.toLowerCase().includes('analyzing') || commentary.toLowerCase().includes('identifying') },
                                            { label: 'Edit', active: commentary.toLowerCase().includes('improving') || commentary.toLowerCase().includes('applying') || (activeRun.iterations_completed > 0 && !commentary) },
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
                                            <span className="text-[10px] font-mono text-[#121212] font-bold">ITERATION {activeRun.iterations_completed + 1}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map((v) => (
                                                <div
                                                    key={v}
                                                    className={cn(
                                                        "flex-1 h-3 rounded-sm transition-all duration-700",
                                                        v <= activeRun.iterations_completed ? "bg-[#121212]" :
                                                            v === activeRun.iterations_completed + 1 ? "bg-[#121212]/20 animate-pulse" : "bg-[#E5E5E5]"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="relative z-10 flex flex-col h-full justify-between min-h-[250px]">
                                <div>
                                    <h3 className="text-xl font-bold mb-2">Ready to Optimize</h3>
                                    
                                    {/* Subtle Info Section */}
                                    <div className="mb-3">
                                        <button
                                            onClick={() => setShowEvalInfo(!showEvalInfo)}
                                            className="flex items-center gap-1.5 text-xs text-[#78716c] hover:text-[#121212] transition-colors group"
                                        >
                                            <Info className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                                            <span className="underline decoration-dotted underline-offset-2">
                                                {showEvalInfo ? "Hide" : "What"} to upload
                                            </span>
                                        </button>
                                        
                                        {showEvalInfo && (
                                            <div className="mt-2 p-3 bg-white/60 border border-[#E5E5E5] rounded-lg text-xs text-[#78716c] space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <p className="font-medium text-[#121212] mb-2">Evaluation Set Format</p>
                                                <p className="leading-relaxed">
                                                    Upload a CSV file with your evaluation data. The system uses this to benchmark and improve the ranking prompt across 5 iterations.
                                                </p>
                                                <div className="mt-3 pt-2 border-t border-[#E5E5E5]">
                                                    <p className="font-medium text-[#121212] mb-1.5">Required Columns:</p>
                                                    <ul className="space-y-1 text-[11px] font-mono bg-[#F5F5F5] p-2 rounded border border-[#E5E5E5]">
                                                        <li><span className="text-[#121212] font-semibold">Full Name</span> - Person's full name</li>
                                                        <li><span className="text-[#121212] font-semibold">Title</span> - Job title or role</li>
                                                        <li><span className="text-[#121212] font-semibold">Company</span> - Company name</li>
                                                        <li><span className="text-[#121212] font-semibold">Employee Range</span> - Company size (e.g., "2-10", "11-50", "51-200")</li>
                                                        <li><span className="text-[#121212] font-semibold">Rank</span> - Ranking number (1 = best) or "-" for irrelevant leads</li>
                                                    </ul>
                                                </div>
                                                <p className="text-[10px] text-[#a3a3a3] mt-2 italic">
                                                    Optional columns (LI, etc.) are ignored. If no file is uploaded, the default evaluation set is used.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <p className="text-sm text-[#78716c] mb-3">
                                        Run a 5-iteration improvement cycle. The system will benchmark against the Evaluation Set and evolve instructions from v1 to v5.
                                    </p>
                                    <p className="text-xs text-[#a3a3a3] mb-6">
                                        Estimation: 5-10 minutes
                                    </p>

                                    {/* Custom Eval Set Upload */}
                                    <div className="mb-4">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileSelect}
                                            accept=".csv"
                                            className="hidden"
                                        />

                                        {customEvalFile ? (
                                            <div className="flex items-center justify-between bg-white/60 border border-[#E5E5E5] rounded-lg px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                    <span className="text-sm font-medium truncate max-w-[200px]">
                                                        {customEvalFile.name}
                                                    </span>
                                                    <Badge variant="secondary" className="text-[10px] bg-[#B4F7C3] text-green-800 border-none">
                                                        {(customEvalFile.size / 1024).toFixed(1)} KB
                                                    </Badge>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setCustomEvalFile(null)}
                                                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full flex items-center justify-center gap-2 bg-white/40 border border-dashed border-[#E5E5E5] rounded-lg px-4 py-3 text-sm text-[#78716c] hover:bg-white/60 hover:border-[#121212] transition-colors"
                                            >
                                                <Upload className="w-4 h-4" />
                                                <span>Upload custom eval set (optional)</span>
                                            </button>
                                        )}
                                        <p className="text-[10px] text-[#a3a3a3] mt-1 text-center">
                                            CSV with columns: Full Name, Title, Company, Employee Range, Rank
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    onClick={startOptimization}
                                    disabled={starting}
                                    className="w-full bg-[#121212] text-white hover:bg-[#121212]/90 h-14 text-lg rounded-lg shadow-xl shadow-purple-500/10 transition-all hover:translate-y-[-2px]"
                                >
                                    {starting ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Initializing...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="mr-2 h-5 w-5 fill-current" />
                                            {customEvalFile ? "Optimize with Custom Eval Set" : "Start Optimization Run"}
                                        </>
                                    )}
                                </Button>

                                {/* Model & API Key Settings */}
                                <div className="space-y-4 pt-4 mt-4 border-t border-[#E5E5E5]">
                                    <button
                                        type="button"
                                        onClick={() => setShowSettings(!showSettings)}
                                        className={`
                                            flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm font-medium transition-all
                                            ${showSettings || configMode !== 'default'
                                                ? 'bg-[#E3DDF7] text-[#2E1A47] hover:bg-[#D0C3FC]'
                                                : 'bg-white border border-[#E5E5E5] text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                                            }
                                        `}
                                    >
                                        <span className="flex items-center gap-2">
                                            {configMode !== 'default' && selectedModel
                                                ? (
                                                    <>
                                                        <span>{SUPPORTED_MODELS.find(m => m.name === selectedModel)?.displayName}</span>
                                                        <span className="w-1 h-1 rounded-full bg-current opacity-40" />
                                                        <span className="flex items-center gap-1.5 text-stone-900">
                                                            {configMode === 'gemini' ? <GeminiIcon className="w-3.5 h-3.5" /> : <GroqIcon className="w-3.5 h-3.5" />}
                                                            <span className="opacity-70">{configMode === 'gemini' ? 'Google' : 'Groq'}</span>
                                                        </span>
                                                    </>
                                                )
                                                : (
                                                    <>
                                                        <span className="opacity-70">Model:</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span>Default (Auto)</span>
                                                            <GeminiIcon className="w-3.5 h-3.5" />
                                                        </div>
                                                    </>
                                                )
                                            }
                                        </span>
                                        <ChevronDown size={14} className={`transition-transform duration-200 ${showSettings ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showSettings && (
                                        <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            {/* Mode Selection */}
                                            <div className="space-y-3">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setConfigMode('default');
                                                        setSelectedModel("");
                                                        setCustomApiKey("");
                                                        setGeminiApiKey("");
                                                    }}
                                                    className={`w-full text-left px-5 py-4 rounded-xl transition-all border ${configMode === 'default'
                                                        ? 'bg-[#E3DDF7] border-[#D0C3FC] ring-1 ring-[#D0C3FC]'
                                                        : 'bg-white border-[#E5E5E5] hover:border-stone-300 hover:bg-stone-50'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-stone-100 rounded-lg">
                                                                <GeminiIcon className="w-5 h-5 text-stone-700" />
                                                            </div>
                                                            <div className="font-medium text-stone-900">Default Configuration (Gemini Flash)</div>
                                                        </div>
                                                        {configMode === 'default' && <Check size={18} className="text-[#2E1A47]" />}
                                                    </div>
                                                    <div className="text-sm text-stone-600 mt-1">
                                                        Uses Gemini Flash 2.5 with my (Felix) Gemini API key
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setConfigMode('gemini');
                                                        setSelectedModel("gemini-2.5-flash");
                                                    }}
                                                    className={`w-full text-left px-5 py-4 rounded-xl transition-all border ${configMode === 'gemini'
                                                        ? 'bg-[#E3DDF7] border-[#D0C3FC] ring-1 ring-[#D0C3FC]'
                                                        : 'bg-white border-[#E5E5E5] hover:border-stone-300 hover:bg-stone-50'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-stone-100 rounded-lg">
                                                                <GeminiIcon className="w-5 h-5 text-stone-700" />
                                                            </div>
                                                            <div className="font-medium text-stone-900">Use your Gemini API key</div>
                                                        </div>
                                                        {configMode === 'gemini' && <Check size={18} className="text-[#2E1A47]" />}
                                                    </div>
                                                    <div className="text-sm text-stone-600 mt-1">
                                                        Tap into Google's latest models for optimization
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setConfigMode('groq');
                                                        setSelectedModel("auto");
                                                    }}
                                                    className={`w-full text-left px-5 py-4 rounded-xl transition-all border ${configMode === 'groq'
                                                        ? 'bg-[#E3DDF7] border-[#D0C3FC] ring-1 ring-[#D0C3FC]'
                                                        : 'bg-white border-[#E5E5E5] hover:border-stone-300 hover:bg-stone-50'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-stone-100 rounded-lg">
                                                                <GroqIcon className="w-5 h-5 text-stone-700" />
                                                            </div>
                                                            <div className="font-medium text-stone-900">Use your Groq API key</div>
                                                        </div>
                                                        {configMode === 'groq' && <Check size={18} className="text-[#2E1A47]" />}
                                                    </div>
                                                    <div className="text-sm text-stone-600 mt-1">
                                                        Choose a specific Groq model and manage your own rate limits
                                                    </div>
                                                </button>
                                            </div>

                                            {/* Configuration Panel */}
                                            {configMode !== 'default' && (
                                                <div className="space-y-6 pt-2 pl-1 animate-in fade-in slide-in-from-top-1">
                                                    {/* Model Selection */}
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-semibold text-stone-900">
                                                            Select Model
                                                        </label>
                                                        <div className="relative group">
                                                            <select
                                                                value={selectedModel}
                                                                onChange={(e) => setSelectedModel(e.target.value)}
                                                                className="appearance-none w-full bg-white border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer font-medium text-stone-700 hover:border-stone-300"
                                                            >
                                                                {configMode === 'groq' && (
                                                                    <option value="auto">All Models (Auto-fallback)</option>
                                                                )}
                                                                {(configMode === 'gemini'
                                                                    ? SUPPORTED_MODELS.filter(m => m.provider === 'Google')
                                                                    : SUPPORTED_MODELS.filter(m => m.provider !== 'Google')
                                                                ).map((model) => (
                                                                    <option key={model.name} value={model.name}>
                                                                        {model.displayName}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none group-hover:text-stone-600 transition-colors" size={16} />
                                                        </div>
                                                        {configMode === 'groq' && selectedModel === 'auto' && (
                                                            <p className="text-xs text-stone-500 pl-1">
                                                                Automatically tries different models and falls back if rate limited
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* API Key Input */}
                                                    <div className="space-y-3 pt-2">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-sm font-semibold text-stone-900">
                                                                {configMode === 'groq' ? 'Groq API Key' : 'Gemini API Key'}
                                                            </label>
                                                            <a
                                                                href={configMode === 'groq' ? "https://console.groq.com/keys" : "https://aistudio.google.com/app/apikey"}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${configMode === 'groq'
                                                                    ? 'text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100'
                                                                    : 'text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100'
                                                                    }`}
                                                            >
                                                                {configMode === 'groq' ? 'Get Groq Key' : 'Get Gemini Key'} <ChevronDown size={10} className="-rotate-90" />
                                                            </a>
                                                        </div>

                                                        <div className="relative flex gap-2">
                                                            <div className="relative flex-1 group">
                                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                    <Key size={14} className="text-stone-400 group-focus-within:text-stone-600" />
                                                                </div>
                                                                <Input
                                                                    type={showApiKey ? "text" : "password"}
                                                                    value={configMode === 'groq' ? customApiKey : geminiApiKey}
                                                                    onChange={(e) => configMode === 'groq' ? setCustomApiKey(e.target.value) : setGeminiApiKey(e.target.value)}
                                                                    placeholder={selectedModel && hasKeyForModel(selectedModel) ? "Using saved key" : (configMode === 'groq' ? "gsk_..." : "AIza...")}
                                                                    className={`pl-9 pr-10 h-11 bg-white border-stone-200 focus:ring-opacity-20 font-mono text-sm shadow-sm ${configMode === 'groq'
                                                                        ? 'focus:border-purple-500 focus:ring-purple-500'
                                                                        : 'focus:border-blue-500 focus:ring-blue-500'
                                                                        }`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                                                                >
                                                                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                onClick={handleSaveApiKey}
                                                                disabled={!(configMode === 'groq' ? customApiKey : geminiApiKey).trim()}
                                                                className="shrink-0 h-11 px-5 bg-stone-900 hover:bg-black text-white shadow-sm"
                                                            >
                                                                {saveKeySuccess ? <Check size={16} /> : "Save"}
                                                            </Button>
                                                        </div>
                                                        {selectedModel && hasKeyForModel(selectedModel) && (
                                                            <div className="flex items-center gap-1.5 text-xs text-green-600 pl-1 font-medium animate-in fade-in slide-in-from-left-2">
                                                                <Check size={12} strokeWidth={3} />
                                                                <span>Key saved securely</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Optimization Strategy */}
                    <div className="bg-white border border-[#E5E5E5] p-6 rounded-xl space-y-4 shadow-sm h-full">
                        <div className="flex items-center gap-2 border-b border-[#E5E5E5] pb-3">
                            <Search className="w-4 h-4 text-[#121212]" />
                            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#121212]">Optimization Strategy</h3>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <h4 className="text-sm font-semibold mb-1 text-[#121212]">Objective</h4>
                                <p className="text-sm text-[#78716c] leading-relaxed">
                                    Maximizing <span className="text-[#121212] font-mono bg-[#E5E5E5]/50 px-1 rounded">F1-Score</span> (Relevance) and <span className="text-[#121212] font-mono bg-[#E5E5E5]/50 px-1 rounded">NDCG@3</span> (Ranking Accuracy) on a held-out evaluation set of 50+ labelled leads.
                                </p>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold mb-1 text-[#121212]">Methodology</h4>
                                <p className="text-sm text-[#78716c] leading-relaxed">
                                    Using <span className="font-medium text-[#121212]">Textual Gradient Descent</span>. The system identifies specific cases where the prompt failed, generates a "critique", and rewrites instructions to fix edge cases without breaking existing behavior.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

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
                                                setCurrentPrompt(version);
                                                setSelectedVersionId(version.id);
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

                {/* Current Active Prompt (New Location, styled like history) */}
                <div className="space-y-6 mb-24">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold flex items-center gap-3">
                                <Terminal className="w-6 h-6" />
                                {selectedVersionId && selectedVersionId !== currentPrompt?.id ? `Prompt Version History (v${promptVersions.find(v => v.id === selectedVersionId)?.version})` : "Current Active Prompt"}
                            </h2>
                            <p className="text-sm text-[#78716c]">
                                {showDiff && currentPrompt ? (
                                    <span>
                                        Highlighting changes made from <strong className="text-[#121212]">v{currentPrompt.version - 1}</strong> to <strong className="text-[#121212]">v{currentPrompt.version}</strong>. <span className="text-green-700 bg-green-50 px-1 rounded font-medium">Green</span> identifies added instructions, <span className="text-red-600 bg-red-50 px-1 rounded line-through decoration-red-400 font-medium">Red</span> identifies deletions.
                                    </span>
                                ) : (
                                    "This is the live system prompt currently being used to score leads. The optimization engine iteratively improves this text based on evaluation results."
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Version Selector */}
                            {promptVersions.length > 1 && (
                                <div className="flex items-center gap-2 bg-[#F9F8F4] border border-[#E5E5E5] rounded-lg p-1">
                                    {promptVersions.slice(0, 5).map(v => (
                                        <button
                                            key={v.id}
                                            onClick={() => {
                                                const selected = v;
                                                setCurrentPrompt(selected);
                                                setSelectedVersionId(selected.id);
                                                // Update diff
                                                if (selected.parent_version_id) {
                                                    const parent = promptVersions.find(pv => pv.id === selected.parent_version_id);
                                                    setPreviousPromptText(parent?.prompt_text || null);
                                                } else {
                                                    setPreviousPromptText(null);
                                                }
                                            }}
                                            className={cn(
                                                "px-2 py-1 text-[10px] font-mono rounded transition-all",
                                                currentPrompt?.id === v.id
                                                    ? "bg-[#121212] text-white"
                                                    : "text-[#78716c] hover:bg-[#E5E5E5]"
                                            )}
                                        >
                                            v{v.version}{v.is_active ? "*" : ""}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {currentPrompt?.composite_score && (
                                <Badge variant="secondary" className="bg-[#B4F7C3] text-[#0f391a] hover:bg-[#B4F7C3] border-none font-mono">
                                    Score: {(currentPrompt.composite_score * 100).toFixed(1)}%
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] bg-[#FAFAFA]">
                            <div className="flex items-center gap-2">
                                <div className="flex gap-1.5">
                                    <div className={`w-3 h-3 rounded-full border border-[#d4d4d4] ${activeRunId ? 'bg-green-400 animate-pulse' : 'bg-[#E5E5E5]'}`} />
                                    <div className="w-3 h-3 rounded-full bg-[#E5E5E5] border border-[#d4d4d4]" />
                                    <div className="w-3 h-3 rounded-full bg-[#E5E5E5] border border-[#d4d4d4]" />
                                </div>
                                <span className="ml-3 text-xs font-mono text-[#78716c] bg-white border border-[#E5E5E5] px-2 py-0.5 rounded text-[10px]">
                                    system_prompt_v{currentPrompt?.version || "1"}.mb
                                </span>
                                {previousPromptText && (
                                    <Badge variant="outline" className="ml-2 text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                        v{currentPrompt!.version - 1} → v{currentPrompt!.version}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {previousPromptText && (
                                    <div className="flex bg-[#E5E5E5]/50 p-1 rounded-lg mr-2">
                                        <button
                                            onClick={() => setShowDiff(false)}
                                            className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", !showDiff ? "bg-white shadow-sm text-[#121212]" : "text-[#78716c] hover:text-[#121212]")}
                                        >
                                            Source
                                        </button>
                                        <button
                                            onClick={() => setShowDiff(true)}
                                            className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", showDiff ? "bg-white shadow-sm text-[#121212]" : "text-[#78716c] hover:text-[#121212]")}
                                        >
                                            Changes
                                        </button>
                                    </div>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowPrompt(!showPrompt)}
                                    className="h-8 text-xs font-mono text-[#78716c] hover:text-[#121212]"
                                >
                                    {showPrompt ? "HIDE" : "VIEW FULL"}
                                </Button>
                            </div>
                        </div>

                        <div className={`transition-all duration-300 ${showPrompt ? 'h-[800px]' : 'h-80'} relative bg-white`}>
                            <div className={`p-8 leading-relaxed h-full overflow-y-auto custom-scrollbar`}>
                                {showDiff && previousPromptText && currentPrompt?.prompt_text ? (
                                    <DiffView oldText={previousPromptText} newText={currentPrompt.prompt_text} />
                                ) : (
                                    <div className="prose prose-sm prose-slate max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-[#121212] font-mono text-sm text-[#333]">
                                        <ReactMarkdown
                                            components={{
                                                code({ node, inline, className, children, ...props }: any) {
                                                    const match = /language-(\w+)/.exec(className || '')
                                                    return !inline && match ? (
                                                        <div className="rounded-md overflow-hidden my-4 border border-[#E5E5E5]">
                                                            <SyntaxHighlighter
                                                                style={oneLight}
                                                                language={match[1]}
                                                                PreTag="div"
                                                                customStyle={{ margin: 0, padding: '1rem', backgroundColor: '#F9F9F9' }}
                                                                {...props}
                                                            >
                                                                {String(children).replace(/\n$/, '')}
                                                            </SyntaxHighlighter>
                                                        </div>
                                                    ) : (
                                                        <code className="bg-[#F3F4F6] px-1.5 py-0.5 rounded text-[#121212] font-semibold text-[13px]" {...props}>
                                                            {children}
                                                        </code>
                                                    )
                                                },
                                                h1: ({ children }) => <h1 className="text-2xl font-bold text-[#121212] border-b pb-2 mb-4">{children}</h1>,
                                                h2: ({ children }) => <h2 className="text-lg font-bold text-[#121212] mt-6 mb-3 uppercase tracking-wider">{children}</h2>,
                                                h3: ({ children }) => <h3 className="text-base font-bold text-[#121212] mt-4 mb-2">{children}</h3>,
                                                ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-2">{children}</ul>,
                                                li: ({ children }) => <li className="text-[#444]">{children}</li>,
                                            }}
                                        >
                                            {currentPrompt?.prompt_text || "// No active prompt found\n// Initialize system to generate first version..."}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                            {!showPrompt && (
                                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/50 to-transparent pointer-events-none" />
                            )}
                        </div>                    </div>
                </div>

                {/* Past Runs Table */}
                {
                    completedRuns.length > 0 && (
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
                    )
                }

                <div className="mt-16 mb-10 max-w-2xl mx-auto bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 px-8 shadow transition-all">
                  <h3 className="text-lg font-bold mb-2 text-yellow-800 flex items-center gap-2">
                    <Info className="w-5 h-5 text-yellow-500" /> About this project
                  </h3>
                  <p className="text-gray-800 text-base mb-2 leading-relaxed">
                    If there were a bit more time, it would've been cool to extend Company Scout to parse all the websites and online profiles of all the users, find new users, and add them in automatically. At the moment it just does this for the top scoring one; you could also imagine creating a graph connecting people, companies, and so on. Basically: I built this demo in just a few hours and it's definitely not perfect! Hope you like it though 🌟
                  </p>
                </div>
            </main >

            {/* Reset Confirmation Modal */}
            {
                showResetModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setShowResetModal(false)}
                        />

                        {/* Modal Content */}
                        <div className="relative bg-[#F9F8F4] border border-[#E5E5E5] w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-6 space-y-4">
                                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
                                    <RotateCcw className="w-6 h-6 text-red-600" />
                                </div>

                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-bold">Start Fresh?</h3>
                                    <p className="text-[#78716c] text-sm leading-relaxed">
                                        This will stop any running optimizations, reset the prompt to the default template, and let you upload a new evaluation set.
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-11"
                                        onClick={() => setShowResetModal(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white border-none"
                                        onClick={confirmReset}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Resetting...
                                            </>
                                        ) : (
                                            "Confirm Reset"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
