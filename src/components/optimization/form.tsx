import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Play, Upload, CheckCircle2, X, ChevronDown, Check, Key, Eye, EyeOff, Info } from "lucide-react";
import { GeminiIcon, GroqIcon } from "@/components/icons";
import { SUPPORTED_MODELS, SavedApiKey } from "@/lib/constants";

interface OptimizationFormProps {
    starting: boolean;
    onStart: (file: File | null, config: any) => void;
    savedKeys: SavedApiKey[];
    onSaveKey: (key: string, provider: 'groq' | 'gemini', model: string) => void;
}

export function OptimizationForm({
    starting,
    onStart,
    savedKeys,
    onSaveKey
}: OptimizationFormProps) {
    const [customEvalFile, setCustomEvalFile] = useState<File | null>(null);
    const [showEvalInfo, setShowEvalInfo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [configMode, setConfigMode] = useState<'default' | 'groq' | 'gemini'>('default');
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [customApiKey, setCustomApiKey] = useState<string>("");
    const [geminiApiKey, setGeminiApiKey] = useState<string>("");
    const [showApiKey, setShowApiKey] = useState(false);
    const [saveKeySuccess, setSaveKeySuccess] = useState(false);

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

    const handleStart = () => {
        const config: any = {};
        if (configMode !== 'default' && selectedModel) {
            config.preferredModel = selectedModel;
        }
        if (configMode === 'groq' && customApiKey) {
            config.apiKey = customApiKey;
        }
        if (configMode === 'gemini' && geminiApiKey) {
            config.geminiApiKey = geminiApiKey;
        }

        onStart(customEvalFile, config);
    };

    const handleSaveKeyWrapper = () => {
        const keyToSave = configMode === 'groq' ? customApiKey : geminiApiKey;
        const provider = configMode === 'groq' ? 'groq' : 'gemini';
        if (keyToSave && selectedModel) {
            onSaveKey(keyToSave, provider, selectedModel);
            setSaveKeySuccess(true);
            setTimeout(() => setSaveKeySuccess(false), 2000);
        }
    };

    const hasKeyForModel = (modelName: string) => {
        return savedKeys.some(k => k.model_name === modelName);
    };

    return (
        <div className="bg-white border border-[#E5E5E5] py-6 px-6 rounded-xl space-y-4 shadow-sm h-full flex flex-col justify-between">
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
                <p className="text-base text-[#121212] mb-6 font-medium">
                    ⏱️ Takes 5-10 minutes — no need to wait around
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

            <div>
                <Button
                    onClick={handleStart}
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
                                                onClick={handleSaveKeyWrapper}
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
        </div>
    );
}
