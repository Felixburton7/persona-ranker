
import { Check, ChevronDown, Eye, EyeOff, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GeminiIcon, GroqIcon } from "@/components/ui/icons";
import { SUPPORTED_MODELS, SavedApiKey } from "@/config/constants";

export type ConfigMode = 'default' | 'groq' | 'gemini';

interface UploadSettingsProps {
    configMode: ConfigMode;
    setConfigMode: (mode: ConfigMode) => void;
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    customApiKey: string;
    setCustomApiKey: (key: string) => void;
    geminiApiKey: string;
    setGeminiApiKey: (key: string) => void;
    showApiKey: boolean;
    setShowApiKey: (show: boolean) => void;
    savedKeys: SavedApiKey[];
    handleSaveApiKey: () => void;
    saveKeySuccess: boolean;
}

export function UploadSettings({
    configMode,
    setConfigMode,
    selectedModel,
    setSelectedModel,
    customApiKey,
    setCustomApiKey,
    geminiApiKey,
    setGeminiApiKey,
    showApiKey,
    setShowApiKey,
    savedKeys,
    handleSaveApiKey,
    saveKeySuccess,
}: UploadSettingsProps) {

    // Filter models based on mode
    const filteredModels = configMode === 'gemini'
        ? SUPPORTED_MODELS.filter(m => m.provider === 'Google')
        : SUPPORTED_MODELS.filter(m => m.provider !== 'Google');

    const hasKeyForModel = (modelName: string) => {
        return savedKeys.some(k => k.model_name === modelName);
    };

    return (
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
    );
}
