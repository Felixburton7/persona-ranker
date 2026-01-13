"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import { UploadForm } from "@/components/upload/form";
import { RankingProgress } from "@/components/ranking/progress";
import { LeadsTable } from "@/components/leads/table";
import { columns } from "@/components/leads/columns";
import { ScoutShowcase } from "@/components/scout/scout-showcase";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function Home() {
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    const savedJobId = localStorage.getItem("currentJobId");
    if (savedJobId) {
      setJobId(savedJobId);
    }
  }, []);

  const handleJobCreated = (id: string) => {
    setJobId(id);
    localStorage.setItem("currentJobId", id);
  };

  return (
    <div className="min-h-screen bg-[#F9F8F4]">
      {/* Navigation */}
      <nav className="max-w-[1400px] mx-auto w-full px-6 py-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-black text-white flex items-center justify-center rounded-sm">
              <Layers size={16} strokeWidth={3} aria-hidden="true" />
            </div>
            <span className="text-[#1A1A1A]">
              lead
              <span className="text-gray-400 font-light">.ranker</span>
            </span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex gap-6 text-sm font-medium text-gray-500 items-center">
            <Link href="/docs" className="hover:text-black cursor-pointer transition-colors">
              Documentation
            </Link>
            <Link href="/optimization" className="hover:text-black cursor-pointer transition-colors">
              Prompt Optimization
            </Link>
            <Link href="/contact" className="hover:text-black cursor-pointer transition-colors">
              Contact us
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-8 relative" role="main">

        <div className="max-w-6xl mx-auto space-y-8">
          <header className={`space-y-6 transition-all duration-700 ease-in-out ${jobId ? 'pt-0' : 'pt-10'}`}>
            <div className={`transition-all duration-700 ${jobId ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
              <span className="bg-[#D0C3FC] text-[#2E1A47] px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full border border-[#B8A5F5] shadow-sm">
                AI-Native Sales Infrastructure
              </span>
            </div>
            <h1 className={`leading-[0.95] tracking-tight font-bold text-[#0F0F0F] transition-all duration-700 ${jobId ? 'text-2xl pt-0' : 'text-5xl lg:text-7xl pt-4'}`}>
              Persona Ranker,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-500">Technical Challenge</span>
            </h1>
            <p className={`text-gray-500 leading-relaxed max-w-lg font-light transition-all duration-700 ${jobId ? 'text-sm mb-4 opacity-80' : 'text-lg mb-10 opacity-100'}`}>
              Upload your leads list (.csv file) and rank them based on the target personas. This project maps organization hierarchies and scores buying intent for every lead. With some bonus features! Checkout Prompt Optimization and Documentation at the top for more!
            </p>
          </header>

          <ErrorBoundary title="Failed to load upload form">
            <UploadForm onJobCreated={handleJobCreated} jobId={jobId} />
          </ErrorBoundary>

          {jobId && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <ErrorBoundary title="Failed to load ranking progress">
                <RankingProgress key={`progress-${jobId}`} jobId={jobId} />
              </ErrorBoundary>

              <ErrorBoundary title="Failed to load leads table">
                <LeadsTable key={`table-${jobId}`} jobId={jobId} columns={columns} />
              </ErrorBoundary>

              <ErrorBoundary title="Failed to load company scout">
                <ScoutShowcase key={`scout-${jobId}`} jobId={jobId} />
              </ErrorBoundary>
            </div>
          )}
        </div>
      </main >
    </div >
  );
}

