import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Terminal } from "lucide-react";
import * as Diff from 'diff';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from "@/core/utils";
import { PromptVersion } from "./types";

interface PromptViewerProps {
    currentPrompt: PromptVersion | null;
    previousPromptText: string | null;
    promptVersions: PromptVersion[];
    selectedVersionId: string | null;
    onVersionSelect: (version: PromptVersion) => void;
}

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

export function PromptViewer({
    currentPrompt,
    previousPromptText,
    promptVersions,
    selectedVersionId,
    onVersionSelect
}: PromptViewerProps) {
    const [showPrompt, setShowPrompt] = useState(false);
    const [showDiff, setShowDiff] = useState(false);

    // Auto-enable diff view if previous prompt is available and not showing full prompt
    // This logic mimics the original page behavior
    // useEffect(() => {
    //     if (previousPromptText) setShowDiff(true);
    // }, [previousPromptText]);

    return (
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
                                    onClick={() => onVersionSelect(v)}
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
                            <div className={`w-3 h-3 rounded-full border border-[#d4d4d4] bg-[#E5E5E5]`} />
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
                </div>
            </div>
        </div>
    );
}
