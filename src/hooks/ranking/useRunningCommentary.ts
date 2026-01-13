"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/core/db/client";

export function useRunningCommentary(jobId: string | null) {
    const [latestActivity, setLatestActivity] = useState<string>("");
    const activityQueue = useRef<string[]>([]);

    // Track IDs of leads we've already announced to avoid spamming "Ranked..." on every update.
    const announcedLeadIds = useRef<Set<string>>(new Set());

    // Track job status to stop processing when completed
    const jobStatus = useRef<string>("pending");

    useEffect(() => {
        if (!jobId) return;

        // Reset state on new job
        activityQueue.current = [];
        announcedLeadIds.current.clear();
        jobStatus.current = "pending";
        setLatestActivity("");

        // 1. Fetch initial state
        const fetchInitialState = async () => {
            // Fetch job status first
            const { data: jobData } = await supabase
                .from('ranking_jobs')
                .select('status')
                .eq('id', jobId)
                .single();

            if (jobData) {
                jobStatus.current = jobData.status;
            }

            // Don't fetch activity if already completed
            if (jobStatus.current === 'completed' || jobStatus.current === 'failed') {
                setLatestActivity("");
                return;
            }

            const { data } = await supabase
                .from('ai_calls')
                .select('*')
                .eq('job_id', jobId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data && data.company_id) {
                const { data: company } = await supabase
                    .from('companies')
                    .select('name')
                    .eq('id', data.company_id)
                    .single();

                if (company) {
                    const modelDisplay = (data.model === 'system-init' ? 'system' : data.model) || "AI";
                    setLatestActivity(`Processing ${company.name} with ${modelDisplay}...`);
                }
            } else {
                setLatestActivity("Ready for action...");
            }
        };

        fetchInitialState();

        // 2. Realtime Subscriptions
        const channel = supabase
            .channel(`commentary-${jobId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "ai_calls",
                    filter: `job_id=eq.${jobId}`,
                },
                async (payload) => {
                    // Don't process new messages if job is completed or failed
                    if (jobStatus.current === 'completed' || jobStatus.current === 'failed') {
                        return;
                    }

                    const record = payload.new;
                    const model = record.model || "AI";
                    const companyId = record.company_id;
                    const callType = record.call_type;

                    if (companyId) {
                        // Optimistically fetch company name or fallback
                        let companyName = "Company";
                        try {
                            const { data } = await supabase.from('companies').select('name').eq('id', companyId).single();
                            if (data) companyName = data.name;
                        } catch (e) {
                            // ignore error
                        }

                        if (callType === 'company_completion') {
                            activityQueue.current.push(`Finished processing ${companyName}.`);
                        } else if (callType === 'ranking_batch') {
                            activityQueue.current.push(`Analyzed batch of candidates at ${companyName}.`);
                        } else if (callType === 'ranking') {
                            // Too noisy? Maybe showing it is fine.
                            // activityQueue.current.push(`Ranking candidate at ${companyName}...`);
                        } else {
                            const modelDisplay = (model === 'system-init' || callType === 'system_init') ? 'System' : model;
                            activityQueue.current.push(modelDisplay === 'System' ? `Initializing analysis for ${companyName}...` : `Processing ${companyName} with ${modelDisplay}...`);
                        }
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "companies",
                },
                (payload) => {
                    // Don't process new messages if job is completed or failed
                    if (jobStatus.current === 'completed' || jobStatus.current === 'failed') {
                        return;
                    }

                    // If scraped_summary changed, it means we analyzed the site
                    const newVal = payload.new;
                    const oldVal = payload.old || {};
                    if (newVal.scraped_summary && (!oldVal.scraped_summary || newVal.scraped_summary !== oldVal.scraped_summary)) {
                        activityQueue.current.push(`Analyzed ${newVal.name} website.`);
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "leads",
                    // No filter (leads don't have job_id). We accept all lead updates. 
                    // This is acceptable as usually only one job runs at a time for the user.
                },
                (payload) => {
                    // Don't process new messages if job is completed or failed
                    if (jobStatus.current === 'completed' || jobStatus.current === 'failed') {
                        return;
                    }

                    const newItem = payload.new;
                    const oldItem = payload.old || {};

                    // Helper to get name
                    const getName = () => newItem.full_name || `${newItem.first_name} ${newItem.last_name}` || "Candidate";

                    // 1. Excluded by Gate
                    // If we see it is excluded, and we haven't announced it yet (or it just flipped), add to queue.
                    if (newItem.excluded_by_gate && !announcedLeadIds.current.has(newItem.id + '-excluded')) {
                        announcedLeadIds.current.add(newItem.id + '-excluded');
                        activityQueue.current.push(`Filtered out ${getName()}: ${newItem.exclusion_reason || "Criteria mismatch"}`);
                        return;
                    }

                    // 2. Rate Limit / Skipped
                    if (newItem.role_type === 'skipped' && !announcedLeadIds.current.has(newItem.id + '-skipped')) {
                        announcedLeadIds.current.add(newItem.id + '-skipped');
                        activityQueue.current.push(`AI MODEL FAILED: Skipped ${getName()} due to rate limits.`);
                        return;
                    }

                    // 3. Email Draft
                    if (newItem.reasoning && newItem.reasoning.includes("Scout Agent Email Draft") && !announcedLeadIds.current.has(newItem.id + '-email')) {
                        announcedLeadIds.current.add(newItem.id + '-email');
                        activityQueue.current.push(`Drafting email for ${getName()}...`);
                        return;
                    }

                    // 4. Ranked (Score)
                    // If it has a score now, and we haven't announced "Ranked" for this ID yet.
                    if (newItem.relevance_score !== null && newItem.relevance_score !== undefined && !announcedLeadIds.current.has(newItem.id + '-ranked')) {
                        announcedLeadIds.current.add(newItem.id + '-ranked');
                        activityQueue.current.push(`Ranked ${getName()} - ${newItem.title || 'No Title'} (Score: ${newItem.relevance_score})`);
                        return;
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "ranking_jobs",
                },
                (payload) => {
                    const newJob = payload.new;
                    if (!newJob || newJob.id !== jobId) return;

                    // Update job status tracking
                    if (newJob.status) {
                        jobStatus.current = newJob.status;
                    }

                    if (newJob.status === 'failed') {
                        activityQueue.current.push(`CRITICAL ERROR: Ranking Job Failed. ${newJob.error || ''}`);
                    }
                    if (newJob.partial_completion && !announcedLeadIds.current.has(jobId + '-partial')) {
                        announcedLeadIds.current.add(jobId + '-partial');
                        activityQueue.current.push(`WARNING: Job finished partially. Models exhausted.`);
                    }
                    if (newJob.status === 'completed') {
                        activityQueue.current.push(`✅ Ranking complete!`);
                    }
                }
            )
            .subscribe();

        // Queue Consumer
        const interval = setInterval(() => {
            if (activityQueue.current.length > 0) {
                const nextActivity = activityQueue.current.shift();
                if (nextActivity) {
                    setLatestActivity(nextActivity);
                }
            }
        }, 800);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [jobId]);

    return latestActivity;
}
