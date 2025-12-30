"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Key, ChevronDown, ChevronUp, Check, X, Eye, EyeOff } from "lucide-react";
import { GeminiIcon, GroqIcon } from "./icons";
import { useJobProgress } from "@/hooks/useJobProgress";
import { SUPPORTED_MODELS, SavedApiKey } from "@/lib/constants";

interface UploadFormProps {
    onJobCreated: (jobId: string) => void;
    jobId?: string | null;
}

export function UploadForm({ onJobCreated, jobId }: UploadFormProps) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentJobId, setCurrentJobId] = useState<string | null>(jobId || null);

    // Track job progress to keep button in loading state until completion
    const jobProgress = useJobProgress(currentJobId);

    // Model & API Key Settings
    const [showSettings, setShowSettings] = useState(false);
    const [configMode, setConfigMode] = useState<'default' | 'groq' | 'gemini'>('default');

    const [selectedModel, setSelectedModel] = useState<string>("");
    const [customApiKey, setCustomApiKey] = useState<string>(""); // For Groq
    const [geminiApiKey, setGeminiApiKey] = useState<string>(""); // For Gemini

    const [showApiKey, setShowApiKey] = useState(false);
    const [savedKeys, setSavedKeys] = useState<SavedApiKey[]>([]);
    const [saveKeySuccess, setSaveKeySuccess] = useState(false);

    // Fetch saved API keys on mount
    useEffect(() => {
        fetchSavedKeys();
    }, []);

    // Monitor job completion to reset loading state
    useEffect(() => {
        if (jobProgress) {
            if (jobProgress.status === 'completed' || jobProgress.status === 'failed') {
                setLoading(false);
                setCurrentJobId(null);
            } else if (jobProgress.status === 'running' || jobProgress.status === 'pending') {
                setLoading(true);
            }
        }
    }, [jobProgress?.status]);

    // Keep internal jobId in sync with prop for refreshes
    useEffect(() => {
        if (jobId && jobId !== currentJobId) {
            setCurrentJobId(jobId);
        }
    }, [jobId]);

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
        // Determine which key/provider to save based on mode
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setError("Please select a file");
            return;
        }

        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);

        // Default mode uses Felix's Gemini Flash
        if (configMode === 'default') {
            formData.append("preferredModel", "gemini-2.5-flash");
            // Do not send hardcoded key; let server use env var
        }

        // Custom Groq/Gemini configurations
        if (configMode !== 'default' && selectedModel) {
            formData.append("preferredModel", selectedModel);
        }

        if (configMode === 'groq' && customApiKey) {
            formData.append("apiKey", customApiKey);
        }

        if (configMode === 'gemini' && geminiApiKey) {
            formData.append("geminiApiKey", geminiApiKey);
        }

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Upload failed");
            }

            // Set the current job ID to track its progress
            setCurrentJobId(data.jobId);
            onJobCreated(data.jobId);
            // Don't set loading to false here - let the job progress monitor handle it
        } catch (err) {
            setError((err as Error).message);
            setLoading(false); // Only reset loading on error
        }
    };

    // Filter models based on mode
    const filteredModels = configMode === 'gemini'
        ? SUPPORTED_MODELS.filter(m => m.provider === 'Google')
        : SUPPORTED_MODELS.filter(m => m.provider !== 'Google');

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-6 border border-stone-200 rounded-lg bg-white shadow-sm">
            <div className="space-y-2">
                <h3 className="font-semibold text-lg">Upload Leads CSV</h3>
                <p className="text-sm text-stone-500">
                    Upload a CSV file (e.g., <code className="bg-stone-100 px-1 rounded text-stone-700">leads.csv - Sheet1.csv</code>) containing leads to begin the ranking process.
                </p>
            </div>

            <div className="space-y-4">
                <div className="relative group">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={loading}
                    />
                    <div className={`p-4 border-2 border-dashed rounded-lg transition-colors flex items-center justify-between
                        ${file ? 'border-purple-300 bg-purple-50/50' : 'border-stone-200 hover:border-stone-300 bg-stone-50/50'}
                    `}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-md ${file ? 'bg-purple-100 text-purple-700' : 'bg-white text-stone-400 border border-stone-200'}`}>
                                <Upload size={18} />
                            </div>
                            <div className="text-sm">
                                {file ? (
                                    <span className="font-medium text-purple-900">{file.name}</span>
                                ) : (
                                    <span className="text-stone-500 group-hover:text-stone-700">Choose a CSV file to upload...</span>
                                )}
                            </div>
                        </div>
                        {file && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    setFile(null);
                                }}
                                className="z-20 p-1 hover:bg-purple-100 rounded-full text-purple-400 hover:text-purple-700 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                    {/* Model Selector Pill */}
                    <button
                        type="button"
                        onClick={() => setShowSettings(!showSettings)}
                        className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                            ${showSettings || configMode !== 'default'
                                ? 'bg-[#E3DDF7] text-[#2E1A47] hover:bg-[#D0C3FC]'
                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
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

                    <Button
                        type="submit"
                        disabled={!file || loading}
                        className={`text-white min-w-[140px] relative overflow-hidden ${loading
                            ? 'bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 bg-[length:200%_100%] animate-shimmer'
                            : 'bg-black hover:bg-stone-800'
                            }`}
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                {jobProgress && (jobProgress.status === 'running' || jobProgress.status === 'pending') ? (
                                    <>
                                        Ranking... {jobProgress.total_leads > 0 ? Math.round((jobProgress.processed_leads / jobProgress.total_leads) * 100) : 0}%
                                    </>
                                ) : (
                                    'Processing...'
                                )}
                            </span>
                        ) : (
                            <>
                                Start Ranking
                                <Upload className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {showSettings && (
                <div className="mt-6 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
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
                                : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
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
                                setSelectedModel("gemini-2.5-flash"); // Best Gemini model
                            }}
                            className={`w-full text-left px-5 py-4 rounded-xl transition-all border ${configMode === 'gemini'
                                ? 'bg-[#E3DDF7] border-[#D0C3FC] ring-1 ring-[#D0C3FC]'
                                : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
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
                                Tap into Google's latest models for high-speed ranking
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setConfigMode('groq');
                                setSelectedModel("auto"); // Auto-fallback default
                            }}
                            className={`w-full text-left px-5 py-4 rounded-xl transition-all border ${configMode === 'groq'
                                ? 'bg-[#E3DDF7] border-[#D0C3FC] ring-1 ring-[#D0C3FC]'
                                : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
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
                                        {filteredModels.map((model) => (
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

            {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">
                    {error}
                </div>
            )}
        </form>
    );
}
