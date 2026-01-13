"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
    const [copied, setCopied] = useState(false);

    const handleCopyEmail = () => {
        navigator.clipboard.writeText("felixburton2002@gmail.com");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-[#F9F8F4] text-[#121212] font-sans selection:bg-[#D0C3FC] selection:text-[#121212]">
            {/* Navigation */}
            <nav className="border-b border-[#E5E5E5]">
                <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#121212] text-white flex items-center justify-center rounded-sm">
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
                        <Link href="/optimization" className="text-sm font-medium text-[#78716c] hover:text-[#121212] transition-colors">
                            Prompt Optimization
                        </Link>
                        <Link href="/contact" className="text-sm font-medium text-[#121212]">
                            Contact us
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-[700px] mx-auto px-6 pt-32 pb-20">
                {/* Header */}
                <div className="mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        Contact
                    </h1>
                    <p className="text-lg text-[#78716c] mb-4">
                        Get in touch about lead.ranker
                    </p>
                    <p className="text-base text-[#121212]">
                        What up! My email is this btw.
                    </p>
                </div>

                {/* Email Section */}
                <div className="space-y-8 mb-16">
                    <div className="border border-[#E5E5E5] bg-white rounded-lg p-8">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-10 h-10 bg-[#121212] text-white rounded-lg flex items-center justify-center flex-shrink-0">
                                <Mail className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold mb-2">Email</h2>
                                <a
                                    href="mailto:felixburton2002@gmail.com"
                                    className="text-lg text-[#121212] hover:underline break-all"
                                >
                                    felixburton2002@gmail.com
                                </a>
                            </div>
                        </div>
                        <Button
                            onClick={handleCopyEmail}
                            className={`w-full h-11 rounded-lg transition-all ${copied
                                ? 'bg-green-600 hover:bg-green-600 text-white'
                                : 'bg-[#121212] text-white hover:bg-[#121212]/90'
                                }`}
                        >
                            {copied ? (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Copied to clipboard
                                </>
                            ) : (
                                'Copy email address'
                            )}
                        </Button>
                    </div>

                    {/* Personal Message */}
                    <div className="border border-[#E5E5E5] bg-white rounded-lg p-8">
                        <p className="text-base text-[#121212] leading-relaxed italic">
                            Had fun making this. My personal email is{" "}
                            <a
                                href="mailto:felixburton2002@gmail.com"
                                className="font-medium text-[#121212] underline decoration-[#D0C3FC] decoration-2 underline-offset-2 hover:decoration-[#BEAEFA] transition-colors"
                            >
                                felixburton2002@gmail.com
                            </a>{" "}
                            btw.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
