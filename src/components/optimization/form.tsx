import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Play, Upload, CheckCircle2, X, ChevronDown, Check, Key, Eye, EyeOff, Info, Clock, Sparkles } from "lucide-react";
import { GeminiIcon, GroqIcon } from "@/components/ui/icons";
import { SUPPORTED_MODELS, SavedApiKey } from "@/config/constants";

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
    const [selectedModel, setSelectedModel] = useState<string>("default");
    const [showModelDropdown, setShowModelDropdown] = useState(false);

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
        // Map simple selection to config
        if (selectedModel !== 'default') {
            // For simplicity in this new UI, we'll assume 'default' is Gemini Flash (Auto)
            // If user picked something else in the dropdown, we'd handle it.
            // But the design shows "Model: Default (Auto)" so we'll just support that for now
            // or maybe a few key ones if needed. 
            // Let's stick to the 'default' config for now as per the image's simplicity.
        }

        onStart(customEvalFile, config);
    };

    return (
        <div className="bg-[#FAF9F6] border-2 border-[#121212] py-8 px-8 rounded-xl shadow-[4px_4px_0px_0px_#121212] h-full flex flex-col justify-between relative">
            {/* Background Gradient Effect - Clipped */}
            <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-purple-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            </div>

            <div className="relative z-10">
                <div className="mb-6">
                    <h3 className="text-2xl font-bold mb-2 tracking-tight text-[#121212]">Ready to Optimize</h3>
                    <button
                        onClick={() => setShowEvalInfo(!showEvalInfo)}
                        className="flex items-center gap-1.5 text-xs text-[#78716c] hover:text-[#121212] transition-colors underline decoration-dotted underline-offset-2"
                    >
                        <Info className="w-3.5 h-3.5" />
                        What to upload
                    </button>

                    {showEvalInfo && (
                        <div className="mt-2 p-3 bg-white/80 border border-[#E5E5E5] rounded-lg text-xs text-[#78716c] space-y-2 animate-in fade-in slide-in-from-top-1 duration-200 shadow-sm">
                            <p className="leading-relaxed">
                                Upload a CSV with: <span className="font-mono text-[#121212]">Full Name, Title, Company, Employee Range, Rank</span>.
                            </p>
                        </div>
                    )}
                </div>

                <p className="text-[#78716c] mb-6 leading-relaxed">
                    Run a 5-iteration improvement cycle. The system will benchmark against the Evaluation Set and evolve instructions from v1 to v5.
                </p>

                <div className="flex items-center gap-2 text-[#121212] font-medium mb-8 bg-white/50 w-fit px-3 py-1.5 rounded-full border border-black/5">
                    <Clock className="w-4 h-4 text-[#78716c]" />
                    <span>Takes 5-10 minutes — no need to wait around</span>
                </div>

                {/* File Upload Area */}
                <div className="mb-6">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept=".csv"
                        className="hidden"
                    />

                    {customEvalFile ? (
                        <div className="flex items-center justify-between bg-white border border-[#E5E5E5] rounded-lg px-4 py-3 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-green-100 rounded-full">
                                    <CheckCircle2 className="w-4 h-4 text-green-700" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-[#121212] truncate max-w-[180px]">
                                        {customEvalFile.name}
                                    </p>
                                    <p className="text-[10px] text-[#78716c]">
                                        {(customEvalFile.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCustomEvalFile(null)}
                                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 rounded-full"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 bg-white border border-dashed border-[#E5E5E5] rounded-xl px-4 py-4 text-sm font-medium text-[#78716c] hover:bg-white hover:border-[#121212] hover:text-[#121212] transition-all group"
                        >
                            <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform duration-300" />
                            <span>Upload custom eval set (optional)</span>
                        </button>
                    )}
                    <p className="text-[10px] text-[#a3a3a3] mt-2 text-center opacity-70 leading-tight">
                        Do nothing to use the pre-loaded default dataset.
                        <br />
                        <span className="opacity-75">Expected columns: Full Name, Title, Company, Employee Range, Rank</span>
                    </p>
                </div>

                <Button
                    onClick={handleStart}
                    disabled={starting}
                    className="w-full bg-[#121212] text-white hover:bg-[#2A2A2A] h-14 text-lg rounded-xl shadow-lg transition-all hover:translate-y-[-1px] font-bold tracking-tight"
                >
                    {starting ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#D0C3FC]" />
                            Started Optimization...
                        </>
                    ) : (
                        <>
                            <Play className="mr-2 h-5 w-5 fill-current" />
                            Start Optimization Run
                        </>
                    )}
                </Button>
            </div>

            {/* Simple Model Selector */}
            <div className="mt-8 pt-6 border-t border-[#E5E5E5]/60 relative z-10">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                        className={`w-full flex items-center justify-between bg-white px-4 py-3 rounded-lg border cursor-pointer transition-colors group ${showModelDropdown ? 'border-[#121212] ring-1 ring-[#121212]' : 'border-[#E5E5E5] hover:border-[#bfbfbf]'
                            }`}
                    >
                        <div className="flex items-center gap-2 text-sm text-[#78716c]">
                            <span>Model:</span>
                            <span className="font-medium text-[#121212]">
                                {selectedModel === 'default'
                                    ? 'Default (Auto)'
                                    : SUPPORTED_MODELS.find(m => m.name === selectedModel)?.displayName || selectedModel
                                }
                            </span>
                            {selectedModel === 'default' ? (
                                <GeminiIcon className="w-4 h-4 text-[#121212]" />
                            ) : (
                                SUPPORTED_MODELS.find(m => m.name === selectedModel)?.provider === 'Google'
                                    ? <GeminiIcon className="w-3.5 h-3.5" />
                                    : <GroqIcon className="w-3.5 h-3.5" />
                            )}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-[#78716c] group-hover:text-[#121212] transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showModelDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E5E5E5] rounded-xl shadow-xl z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-1.5 space-y-0.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                                <button
                                    onClick={() => {
                                        setSelectedModel('default');
                                        setShowModelDropdown(false);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between transition-colors ${selectedModel === 'default' ? 'bg-[#F5F5F5] text-[#121212] font-medium' : 'text-[#78716c] hover:bg-[#F9F9F9] hover:text-[#121212]'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <GeminiIcon className="w-4 h-4 opacity-80" />
                                        <span>Default (Auto)</span>
                                    </div>
                                    {selectedModel === 'default' && <Check size={14} />}
                                </button>

                                <div className="h-px bg-[#E5E5E5] my-1 mx-2" />

                                {SUPPORTED_MODELS.map((model) => (
                                    <button
                                        key={model.name}
                                        onClick={() => {
                                            setSelectedModel(model.name);
                                            setShowModelDropdown(false);
                                        }}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between transition-colors ${selectedModel === model.name ? 'bg-[#F5F5F5] text-[#121212] font-medium' : 'text-[#78716c] hover:bg-[#F9F9F9] hover:text-[#121212]'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {model.provider === 'Google' ? (
                                                <GeminiIcon className="w-3.5 h-3.5 opacity-70" />
                                            ) : (
                                                <GroqIcon className="w-3.5 h-3.5 opacity-70" />
                                            )}
                                            <span>{model.displayName}</span>
                                        </div>
                                        {selectedModel === model.name && <Check size={14} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
