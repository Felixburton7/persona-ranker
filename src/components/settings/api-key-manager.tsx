"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Key, Trash2, Eye, EyeOff, Check } from "lucide-react";
import { GeminiIcon, GroqIcon } from "@/components/ui/icons";

interface ApiKey {
    id: string;
    provider: string;
    model_name: string;
    api_key: string;
    base_url?: string;
    display_name?: string;
    is_active: boolean;
}

interface SupportedModel {
    name: string;
    displayName: string;
    provider: string;
    defaultBaseUrl: string;
    description: string;
}

const SUPPORTED_MODELS: SupportedModel[] = [
    {
        name: "llama-3.3-70b-versatile",
        displayName: "Llama 3.3 70B (Versatile)",
        provider: "groq",
        defaultBaseUrl: "https://api.groq.com/openai/v1",
        description: "Balanced model, 70B params - Best for general use"
    },
    {
        name: "llama-3.1-8b-instant",
        displayName: "Llama 3.1 8B (Instant)",
        provider: "groq",
        defaultBaseUrl: "https://api.groq.com/openai/v1",
        description: "Fastest model, 8B params - Great for small companies"
    },
    {
        name: "qwen/qwen3-32b",
        displayName: "Qwen 3 32B",
        provider: "groq",
        defaultBaseUrl: "https://api.groq.com/openai/v1",
        description: "Efficient model, 32B params"
    },
    {
        name: "openai/gpt-oss-120b",
        displayName: "GPT OSS 120B",
        provider: "groq",
        defaultBaseUrl: "https://api.groq.com/openai/v1",
        description: "Most powerful, 120B params - For large companies"
    },
    {
        name: "moonshotai/kimi-k2-instruct-0905",
        displayName: "Kimi K2 Instruct",
        provider: "groq",
        defaultBaseUrl: "https://api.groq.com/openai/v1",
        description: "Large context window (262K)"
    },
    {
        name: "openai/gpt-oss-20b",
        displayName: "GPT OSS 20B",
        provider: "groq",
        defaultBaseUrl: "https://api.groq.com/openai/v1",
        description: "Lighter alternative, 20B params"
    },
    {
        name: "groq/compound",
        displayName: "Groq Compound",
        provider: "groq",
        defaultBaseUrl: "https://api.groq.com/openai/v1",
        description: "Groq native model"
    },
    {
        name: "meta-llama/llama-4-scout-17b-16e-instruct",
        displayName: "Llama 4 Scout 17B",
        provider: "groq",
        defaultBaseUrl: "https://api.groq.com/openai/v1",
        description: "Experimental model"
    },
    {
        name: "gemini-2.0-flash-exp",
        displayName: "Gemini 2.0 Flash Exp",
        provider: "gemini",
        defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
        description: "Fast, high quality (Google)"
    },
    {
        name: "gemini-2.0-flash",
        displayName: "Gemini 2.0 Flash",
        provider: "gemini",
        defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
        description: "Stable flash model (Google)"
    }
];

interface ApiKeyManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ApiKeyManager({ isOpen, onClose }: ApiKeyManagerProps) {
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddCustom, setShowAddCustom] = useState(false);
    const [selectedModel, setSelectedModel] = useState<SupportedModel | null>(null);
    const [newKey, setNewKey] = useState("");
    const [customModelName, setCustomModelName] = useState("");
    const [customBaseUrl, setCustomBaseUrl] = useState("");
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchApiKeys();
        }
    }, [isOpen]);

    const fetchApiKeys = async () => {
        try {
            const res = await fetch("/api/settings/api-keys");
            if (res.ok) {
                const data = await res.json();
                setApiKeys(data.keys || []);
            }
        } catch (error) {
            console.error("Failed to fetch API keys:", error);
        }
    };

    const handleSaveKey = async () => {
        if (!newKey.trim()) return;

        setLoading(true);
        setSaveSuccess(false);

        try {
            const payload = showAddCustom
                ? {
                    provider: "custom",
                    model_name: customModelName,
                    api_key: newKey,
                    base_url: customBaseUrl,
                    display_name: customModelName
                }
                : {
                    provider: selectedModel?.provider || "groq",
                    model_name: selectedModel?.name || "",
                    api_key: newKey,
                    base_url: selectedModel?.defaultBaseUrl,
                    display_name: selectedModel?.displayName
                };

            const res = await fetch("/api/settings/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                await fetchApiKeys();
                setNewKey("");
                setSelectedModel(null);
                setShowAddCustom(false);
                setCustomModelName("");
                setCustomBaseUrl("");
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
            }
        } catch (error) {
            console.error("Failed to save API key:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteKey = async (id: string) => {
        try {
            const res = await fetch(`/api/settings/api-keys?id=${id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                await fetchApiKeys();
            }
        } catch (error) {
            console.error("Failed to delete API key:", error);
        }
    };

    const toggleShowKey = (id: string) => {
        setShowKey(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                            <Key className="text-purple-600" size={20} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">API Key Management</h2>
                            <p className="text-sm text-gray-500">Configure your LLM provider API keys</p>
                        </div>
                    </div>
                    <Button
                        onClick={onClose}
                        variant="ghost"
                        className="rounded-full w-8 h-8 p-0"
                    >
                        <X size={18} />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Success Message */}
                    {saveSuccess && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                            <Check className="text-green-600" size={20} />
                            <span className="text-green-700 font-medium">API key saved successfully!</span>
                        </div>
                    )}

                    {/* Existing Keys */}
                    {apiKeys.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                                Configured API Keys
                            </h3>
                            <div className="space-y-3">
                                {apiKeys.map((key) => (
                                    <div
                                        key={key.id}
                                        className="border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-gray-300 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                                                {key.provider === 'gemini' ? <GeminiIcon className="w-4 h-4 text-blue-600" /> : <GroqIcon className="w-4 h-4 text-orange-600" />}
                                                {key.display_name || key.model_name}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {key.provider} • {key.model_name}
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                                                    {showKey[key.id]
                                                        ? key.api_key
                                                        : `${key.api_key.substring(0, 8)}...${key.api_key.substring(key.api_key.length - 4)}`
                                                    }
                                                </code>
                                                <Button
                                                    onClick={() => toggleShowKey(key.id)}
                                                    variant="ghost"
                                                    className="h-6 w-6 p-0"
                                                >
                                                    {showKey[key.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </Button>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => handleDeleteKey(key.id)}
                                            variant="ghost"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 size={18} />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add New Key Section */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                            Add New API Key
                        </h3>

                        {/* Toggle between preset and custom */}
                        <div className="flex gap-2 mb-4">
                            <Button
                                onClick={() => setShowAddCustom(false)}
                                variant={!showAddCustom ? "default" : "outline"}
                                className="flex-1"
                            >
                                Preset Models
                            </Button>
                            <Button
                                onClick={() => setShowAddCustom(true)}
                                variant={showAddCustom ? "default" : "outline"}
                                className="flex-1"
                            >
                                <Plus size={16} className="mr-2" />
                                Custom Model
                            </Button>
                        </div>

                        {!showAddCustom ? (
                            /* Preset Models */
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                                        Select Model
                                    </label>
                                    <select
                                        value={selectedModel?.name || ""}
                                        onChange={(e) => {
                                            const model = SUPPORTED_MODELS.find(m => m.name === e.target.value);
                                            setSelectedModel(model || null);
                                        }}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="">Choose a model...</option>
                                        {SUPPORTED_MODELS.map((model) => (
                                            <option key={model.name} value={model.name}>
                                                {model.displayName}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedModel && (
                                        <p className="text-xs text-gray-500 mt-2">
                                            {selectedModel.description}
                                        </p>
                                    )}
                                </div>

                                {selectedModel && (
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                                            API Key
                                        </label>
                                        <Input
                                            type="password"
                                            value={newKey}
                                            onChange={(e) => setNewKey(e.target.value)}
                                            placeholder="Enter your API key..."
                                            className="font-mono"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Custom Model */
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                                        Model Name
                                    </label>
                                    <Input
                                        value={customModelName}
                                        onChange={(e) => setCustomModelName(e.target.value)}
                                        placeholder="e.g., gpt-4, claude-3-opus"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                                        Base URL (optional)
                                    </label>
                                    <Input
                                        value={customBaseUrl}
                                        onChange={(e) => setCustomBaseUrl(e.target.value)}
                                        placeholder="e.g., https://api.openai.com/v1"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                                        API Key
                                    </label>
                                    <Input
                                        type="password"
                                        value={newKey}
                                        onChange={(e) => setNewKey(e.target.value)}
                                        placeholder="Enter your API key..."
                                        className="font-mono"
                                    />
                                </div>
                            </div>
                        )}

                        <Button
                            onClick={handleSaveKey}
                            disabled={loading || !newKey.trim() || (!showAddCustom && !selectedModel) || (showAddCustom && !customModelName.trim())}
                            className="w-full mt-4"
                        >
                            {loading ? "Saving..." : "Save API Key"}
                        </Button>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">ℹ️ About API Keys</h4>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>• Keys are stored securely and used for LLM ranking operations</li>
                            <li>• The system will prioritize user-provided keys over environment variables</li>
                            <li>• Multiple models supported with automatic fallback on rate limits</li>
                            <li>• If no key is configured, the system uses server default keys</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
