"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Loader2, RotateCcw, X, AlertCircle, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

// Import new components
import { OptimizationHeader } from "@/components/optimization/header";
import { OptimizationWorkflow } from "@/components/optimization/workflow";
import { OptimizationStatus } from "@/components/optimization/status-card";
import { OptimizationForm } from "@/components/optimization/form";
import { OptimizationHistory } from "@/components/optimization/history";
import { PromptViewer } from "@/components/optimization/prompt-viewer";
import { OptimizationStrategy } from "@/components/optimization/strategy";
import { OptimizationRun, PromptVersion } from "@/components/optimization/types";
import { SavedApiKey } from "@/config/constants";

export default function OptimizationPage() {
    const [runs, setRuns] = useState<OptimizationRun[]>([]);
    const [loading, setLoading] = useState(false);
    const [starting, setStarting] = useState(false);
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const [currentPrompt, setCurrentPrompt] = useState<PromptVersion | null>(null);
    const [previousPromptText, setPreviousPromptText] = useState<string | null>(null);
    const [showResetModal, setShowResetModal] = useState(false);

    // Settings State
    const [savedKeys, setSavedKeys] = useState<SavedApiKey[]>([]);

    const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

    // Real-time commentary state
    const [commentary, setCommentary] = useState<string>("");

    // Session Management
    const [sessionKey, setSessionKey] = useState<string>("");

    useEffect(() => {
        // Initialize Session Key
        let key = localStorage.getItem("optimization_session_key");
        if (!key) {
            key = crypto.randomUUID();
            localStorage.setItem("optimization_session_key", key);
        }
        setSessionKey(key);

        loadRuns(false, key);
        loadCurrentPrompt(false, key);
        fetchSavedKeys();
    }, []);

    const loadCurrentPrompt = async (isSilent = false, key?: string) => {
        const currentKey = key || sessionKey;
        if (!currentKey) return;

        if (!isSilent) setLoading(true);
        const supabaseClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Fetch prompts only for this session
        const { data: versions } = await supabaseClient
            .from("prompt_versions")
            .select("*")
            .eq("session_key", currentKey)
            .order("version", { ascending: false });

        if (versions && versions.length > 0) {
            setPromptVersions(versions);
            const active = versions.find((v: PromptVersion) => v.is_active) || versions[0];
            setCurrentPrompt(active);

            if (!selectedVersionId) {
                setSelectedVersionId(active.id);
            }

            if (active.parent_version_id) {
                const parent = versions.find((v: PromptVersion) => v.id === active.parent_version_id);
                if (parent) {
                    setPreviousPromptText(parent.prompt_text);
                }
            }
        } else {
            // No prompts for this session yet
            setPromptVersions([]);
            setCurrentPrompt(null);
            setPreviousPromptText(null);
        }
        if (!isSilent) setLoading(false);
    };

    // Poll for commentary and status updates
    useEffect(() => {
        if (!sessionKey) return;

        const supabaseClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Subscriptions for real-time updates - Scoped to Session
        const channel = supabaseClient
            .channel(`optimization-updates-${sessionKey}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "ai_calls",
                    // Note: We can't easily filter ai_calls by session_key directly as it's not on the table
                    // But we can rely on the fact that only runs associated with this session will trigger specific updates?
                    // Actually, for ai_calls, we might hear others. 
                    // To be strictly isolated, we'd need session_key on ai_calls or join.
                    // For now, we'll accept hearing "global" ai_calls or hope for the best, 
                    // OR better: rely on optimization_runs updates which ARE scoped.
                    // Let's keep ai_calls global-ish for commentary, or filter client-side if we could link it.
                    // Ideally ai_calls should have session_key too, but that's a bigger migration.
                    // We will just filter optimization_runs strictly.
                },
                (payload) => {
                    // Update commentary regardless (fun factor), or filter if possible
                    const record = payload.new;
                    if (record.call_type === 'gradient') {
                        setCommentary(`Analyzing error patterns and identifying rule weaknesses...`);
                    } else if (record.call_type === 'optimization') {
                        setCommentary(`Running benchmark: Evaluating prompt on test leads...`);
                    } else if (record.call_type === 'eval_progress') {
                        setCommentary(record.model);
                    } else if (record.call_type === 'edit') {
                        setCommentary(`Applying textual gradient descent to refine prompt instructions...`);
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "optimization_runs",
                    filter: `session_key=eq.${sessionKey}`
                },
                () => {
                    loadRuns(true, sessionKey);
                    loadCurrentPrompt(true, sessionKey);
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "prompt_versions",
                    filter: `session_key=eq.${sessionKey}`
                },
                () => {
                    loadCurrentPrompt(true, sessionKey);
                }
            )
            .subscribe();

        // Fallback polling
        const interval = setInterval(() => {
            loadRuns(true, sessionKey);
        }, 5000);

        return () => {
            supabaseClient.removeChannel(channel);
            clearInterval(interval);
        };
    }, [sessionKey]);

    const loadRuns = async (isSilent = false, key?: string) => {
        const currentKey = key || sessionKey;
        if (!currentKey) return;

        try {
            if (!isSilent) setLoading(true);
            const res = await fetch("/api/optimization", {
                headers: {
                    "x-session-key": currentKey
                }
            });
            const data = await res.json();

            if (data.runs) {
                setRuns(data.runs);

                const runningRun = data.runs.find((r: OptimizationRun) =>
                    r.status === "running" || r.status === "pending"
                );
                setActiveRunId(runningRun?.id || null);

                if (runningRun) {
                    loadCurrentPrompt(true, currentKey);
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

    const handleSaveApiKey = async (key: string, provider: 'groq' | 'gemini', model: string) => {
        try {
            const res = await fetch("/api/settings/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: provider,
                    model_name: model,
                    api_key: key,
                    base_url: provider === 'groq' ? "https://api.groq.com/openai/v1" : "https://generativelanguage.googleapis.com/v1beta/openai/",
                    display_name: model
                })
            });

            if (res.ok) {
                await fetchSavedKeys();
            }
        } catch (e) {
            console.error("Failed to save API key:", e);
        }
    };

    const startOptimization = async (file: File | null, config: any) => {
        try {
            setStarting(true);
            let res: Response;

            if (file) {
                const formData = new FormData();
                formData.append("maxIterations", "5");
                formData.append("evalSetCsv", file);
                formData.append("sessionKey", sessionKey); // Pass session key

                if (config.preferredModel) formData.append("preferredModel", config.preferredModel);
                if (config.apiKey) formData.append("apiKey", config.apiKey);
                if (config.geminiApiKey) formData.append("geminiApiKey", config.geminiApiKey);

                res = await fetch("/api/optimization", {
                    method: "POST",
                    headers: {
                        "x-session-key": sessionKey // Redundant but good for middleware if any
                    },
                    body: formData,
                });
            } else {
                const payload = { ...config, maxIterations: 5, sessionKey };
                res = await fetch("/api/optimization", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-session-key": sessionKey
                    },
                    body: JSON.stringify(payload),
                });
            }

            const data = await res.json();

            if (data.success) {
                setActiveRunId(data.runId);
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
                headers: {
                    "x-session-key": sessionKey // Pass session key
                }
            });
            const data = await res.json();

            if (data.success) {
                setActiveRunId(null);
                await loadCurrentPrompt(false, sessionKey);
                await loadRuns(false, sessionKey);
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

    const handleVersionSelect = (version: PromptVersion) => {
        setCurrentPrompt(version);
        setSelectedVersionId(version.id);
        if (version.parent_version_id) {
            const parent = promptVersions.find(pv => pv.id === version.parent_version_id);
            setPreviousPromptText(parent?.prompt_text || null);
        } else {
            setPreviousPromptText(null);
        }
    };

    const activeRun = runs.find(r => r.status === "running" || r.status === "pending");

    return (
        <div className="min-h-screen bg-[#F9F8F4] text-[#121212] font-sans selection:bg-[#D0C3FC] selection:text-[#121212]">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F9F8F4]/80 backdrop-blur-md border-b border-[#E5E5E5]">
                <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-[#121212] flex items-center justify-center rounded-sm transition-transform group-hover:scale-105">
                            <div className="w-4 h-4 rounded-full bg-white" />
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

                <OptimizationHeader onReset={() => setShowResetModal(true)} />
                <OptimizationWorkflow />

                {/* Primary Interaction Area */}
                {/* Header Row - Aligned with Left Column */}
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
                            className="h-8 border-[#E5E5E5] bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"
                        >
                            <RotateCcw className="w-3 h-3 mr-2" />
                            Start Fresh
                        </Button>
                    </div>
                    {/* Empty Right Column Spacer */}
                    <div className="hidden lg:block" />
                </div>

                {/* Primary Interaction Area - Cards Grid */}
                <div className="grid lg:grid-cols-2 gap-12 mb-24 items-start">
                    {/* Left Column: Toggles between Form (Ready) and Status (Running) */}
                    <div className="h-full">
                        {activeRun ? (
                            <OptimizationStatus
                                activeRun={activeRun}
                                starting={starting}
                                commentary={commentary}
                                promptVersions={promptVersions}
                                currentPrompt={currentPrompt}
                                onVersionSelect={handleVersionSelect}
                            />
                        ) : (
                            <OptimizationForm
                                starting={starting}
                                onStart={startOptimization}
                                savedKeys={savedKeys}
                                onSaveKey={handleSaveApiKey}
                            />
                        )}
                    </div>

                    {/* Right Column: Strategy Explanation */}
                    <div className="h-full">
                        <OptimizationStrategy isOptimizing={!!activeRun || starting} />
                    </div>
                </div>

                <OptimizationHistory
                    activeRun={activeRun || null}
                    runs={runs}
                    promptVersions={promptVersions}
                    currentPrompt={currentPrompt}
                    onVersionSelect={handleVersionSelect}
                />

                <PromptViewer
                    currentPrompt={currentPrompt}
                    previousPromptText={previousPromptText}
                    promptVersions={promptVersions}
                    selectedVersionId={selectedVersionId}
                    onVersionSelect={handleVersionSelect}
                />
            </main>

            {/* Reset Confirmation Modal */}
            {showResetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold mb-4">Reset System Prompt?</h3>
                        <p className="text-[#78716c] mb-6 leading-relaxed">
                            This will wipe all optimization history and revert the system instructions to the original <span className="font-mono text-sm bg-stone-100 px-1 rounded">v0.1-candidate</span>.
                            <br /><br />
                            <strong className="text-red-600">This action cannot be undone.</strong>
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setShowResetModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={confirmReset}
                                disabled={loading}
                            >
                                {loading ? "Resetting..." : "Yes, Start Over"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Navigation Item Helper
function NavItem({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className={`text-sm font-medium transition-colors ${active ? "text-[#121212]" : "text-[#78716c] hover:text-[#121212]"
                }`}
        >
            {children}
        </Link>
    );
}
