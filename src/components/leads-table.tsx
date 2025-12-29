"use client"

import * as React from "react"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    SortingState,
    getExpandedRowModel,
} from "@tanstack/react-table"
import { Info, User, Building2, CheckCircle2, Mail, Code, Brain, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table" // I need to implement this or use raw
import { ExportDialog } from "@/components/export-dialog"
import { supabase } from "@/lib/db/client" // Use client-side client if possible?
// We need to fetch data.
import { useEffect, useState } from "react"
import { Lead } from "./columns"

interface LeadsTableProps {
    jobId: string
    columns: ColumnDef<Lead>[]
}

// I need to implement src/components/ui/table.tsx first or inline it.
// I will assume standard shadcn table structure is available or I will create it.
// For now, I'll use standard HTML in the render if table.tsx is missing, but plan says "LeadsTable".

export function LeadsTable({ jobId, columns }: LeadsTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [data, setData] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set())
    const [expanded, setExpanded] = useState({})
    const [positionChanged, setPositionChanged] = useState<Set<string>>(new Set())
    const previousPositionsRef = React.useRef<Map<string, number>>(new Map())

    useEffect(() => {
        if (!jobId) return;

        const fetchData = async () => {
            setLoading(true)
            const { data: calls } = await supabase
                .from("ai_calls")
                .select("company_id")
                .eq("job_id", jobId);

            const companyIds = Array.from(new Set(calls?.map(c => c.company_id)))

            if (companyIds.length === 0) {
                setLoading(false)
                return
            }

            const { data: leads } = await supabase
                .from("leads")
                .select(`
                *,
                companies (name, size_bucket)
            `)
                .in("company_id", companyIds);

            if (leads) {
                const flattened = leads.map((l: any) => ({
                    ...l,
                    company_name: l.companies?.name,
                    company_size: l.companies?.size_bucket
                }))

                const sorted = flattened.sort((a, b) => {
                    const aHasRank = a.rank_within_company != null && a.rank_within_company >= 1
                    const bHasRank = b.rank_within_company != null && b.rank_within_company >= 1

                    if (aHasRank && !bHasRank) return -1
                    if (!aHasRank && bHasRank) return 1

                    if (aHasRank && bHasRank) {
                        if (a.rank_within_company !== b.rank_within_company) {
                            return a.rank_within_company! - b.rank_within_company!
                        }
                        // Fall through to score if ranks are the same (different companies)
                    }

                    const aScore = a.relevance_score || 0
                    const bScore = b.relevance_score || 0
                    return bScore - aScore
                })

                // Track position changes for animation
                const newPositions = new Map<string, number>()
                const changedIds = new Set<string>()

                sorted.forEach((lead, index) => {
                    newPositions.set(lead.id, index)
                    const previousPosition = previousPositionsRef.current.get(lead.id)

                    // If position changed and we had a previous position, trigger animation
                    if (previousPosition !== undefined && previousPosition !== index) {
                        changedIds.add(lead.id)
                    }
                })

                // Update position tracking
                previousPositionsRef.current = newPositions

                // Trigger animation for changed positions
                if (changedIds.size > 0) {
                    setPositionChanged(changedIds)
                    setTimeout(() => {
                        setPositionChanged(new Set())
                    }, 600) // Match animation duration
                }

                setData(sorted)
            }
            setLoading(false)
        }

        fetchData()

        let debounceTimer: NodeJS.Timeout;
        const debouncedFetch = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchData();
            }, 500);
        };

        const channel = supabase
            .channel('table-updates')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
                const leadId = (payload.new as any).id
                setRecentlyUpdated(prev => new Set(prev).add(leadId))
                setTimeout(() => {
                    setRecentlyUpdated(prev => {
                        const next = new Set(prev)
                        next.delete(leadId)
                        return next
                    })
                }, 2000)
                debouncedFetch()
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => {
                debouncedFetch()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel);
            clearTimeout(debounceTimer);
        }
    }, [jobId])

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        onExpandedChange: setExpanded,
        initialState: {
            pagination: {
                pageSize: 50, // Larger page size for scrollable view
            },
        },
        state: {
            sorting,
            expanded,
        },
    })

    return (
        <div className="space-y-4">
            <style jsx>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                @keyframes slideInFromLeft {
                    from { 
                        opacity: 0.3; 
                        transform: translateX(-20px);
                    }
                    to { 
                        opacity: 1; 
                        transform: translateX(0);
                    }
                }
                
                @keyframes pulse-highlight {
                    0%, 100% { background-color: rgba(234, 179, 8, 0.1); }
                    50% { background-color: rgba(234, 179, 8, 0.3); }
                }
                
                .lead-row { transition: all 0.3s ease; cursor: pointer; }
                .lead-row:hover { background-color: #f5f5f4; }
                
                .lead-row-updated {
                    animation: pulse-highlight 1s ease-in-out 2;
                    border-left: 3px solid #eab308 !important;
                }
                
                .lead-row-position-changed {
                    animation: slideInFromLeft 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                
                .lead-row-ranked {
                    background-color: rgba(34, 197, 94, 0.02);
                }

                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e7e5e4;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #d6d3d1;
                }
            `}</style>

            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Ranking Results</h2>
                <div className="flex gap-2">
                    <ExportDialog jobId={jobId} />
                </div>
            </div>

            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                <div className="w-full relative h-[600px] overflow-auto custom-scrollbar">
                    <table className="w-full text-sm text-left caption-bottom">
                        <thead className="bg-stone-50 text-stone-700 uppercase sticky top-0 z-10 shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <th key={header.id} className="px-4 py-3 bg-stone-50 sticky top-0 z-10 shadow-sm border-b">
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </th>
                                        )
                                    })}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => {
                                    const lead = row.original as any
                                    const isRanked = lead.rank_within_company != null && lead.rank_within_company >= 1
                                    const isRecentlyUpdated = recentlyUpdated.has(lead.id)
                                    const hasPositionChanged = positionChanged.has(lead.id)

                                    return (
                                        <React.Fragment key={row.id}>
                                            <tr
                                                onClick={() => row.toggleExpanded()}
                                                className={`
                                                    border-b lead-row
                                                    ${isRecentlyUpdated ? 'lead-row-updated' : ''}
                                                    ${hasPositionChanged ? 'lead-row-position-changed' : ''}
                                                    ${isRanked ? 'lead-row-ranked' : ''}
                                                    ${lead.role_type === 'skipped' ? 'lead-row-skipped bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500' : ''}
                                                    ${row.getIsExpanded() ? 'bg-stone-50' : ''}
                                                `}
                                                data-state={row.getIsSelected() && "selected"}
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <td key={cell.id} className="px-4 py-3">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                            {row.getIsExpanded() && (
                                                <tr className="bg-stone-50/50">
                                                    <td colSpan={columns.length} className="p-4 border-b">
                                                        <ExpandedLeadView lead={lead} />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="h-24 text-center">
                                        {loading ? "Loading results..." : "No results."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

            </div>

            <div className="flex items-center justify-between py-4">
                <div className="text-xs text-muted-foreground">
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}

function ExpandedLeadView({ lead }: { lead: any }) {
    const [showRaw, setShowRaw] = useState(false)

    return (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-300">
            {/* Header */}
            <div className={`px-6 py-3 border-b flex items-center justify-between ${lead.role_type === 'skipped' ? 'bg-red-50 border-red-100' : 'bg-stone-50/50 border-stone-200'}`}>
                <div className="flex items-center gap-2">
                    <div className={`p-1 rounded-md ${lead.role_type === 'skipped' ? 'bg-red-100' : 'bg-stone-100'}`}>
                        {lead.role_type === 'skipped' ? (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                        ) : (
                            <Info className="w-4 h-4 text-stone-600" />
                        )}
                    </div>
                    <h3 className={`text-sm font-semibold font-sans ${lead.role_type === 'skipped' ? 'text-red-900' : 'text-stone-900'}`}>
                        {lead.role_type === 'skipped' ? 'Processing Error' : 'Company Scout'}
                    </h3>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-stone-400 font-medium uppercase tracking-wider">
                    {lead.role_type === 'skipped' ? (
                        <span className="text-red-500 font-bold">Skipped</span>
                    ) : (
                        <>
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                            Analysis Complete
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-100">
                {/* Left Column: Target Profile */}
                <div className="p-6 space-y-6">
                    <div>
                        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <User className="w-3.5 h-3.5" />
                            Target Profile
                        </h4>

                        <div className="bg-white rounded-xl border border-stone-100 p-5 shadow-sm space-y-4">
                            <div>
                                <div className="text-xl font-bold text-stone-900 tracking-tight">{lead.full_name || "Unknown Contact"}</div>
                                <div className="text-sm font-medium text-purple-600">{lead.title || "No Title"}</div>
                                <div className="flex items-center gap-1.5 mt-2 text-sm text-stone-500">
                                    <Building2 className="w-3.5 h-3.5" />
                                    {lead.company_name}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-stone-100 grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Relevance</div>
                                    <div className="text-2xl font-bold text-stone-700">{lead.relevance_score}<span className="text-sm text-stone-400 font-normal">/100</span></div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Role Type</div>
                                    <div className="text-sm font-medium text-stone-700 capitalize mt-1.5">
                                        {(lead.role_type || "N/A").replace(/_/g, " ")}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-stone-400 italic flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Selected as top prospect based on relevance signals
                    </div>
                </div>

                {/* Right Column: Outreach Draft / Reasoning */}
                <div className="p-6 bg-stone-50/30">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                            {lead.role_type === 'skipped' ? (
                                <span className="text-red-600 flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Error Details
                                </span>
                            ) : (lead.reasoning || "").includes("Scout Agent Email Draft") ? (
                                <>
                                    <Mail className="w-3.5 h-3.5" />
                                    Autonomous Outreach Draft
                                </>
                            ) : (
                                <>
                                    <Brain className="w-3.5 h-3.5" />
                                    Reasoning Summary
                                </>
                            )}
                        </h4>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] hover:bg-purple-50 text-stone-400 hover:text-purple-600"
                            onClick={() => setShowRaw(!showRaw)}
                        >
                            <Code className="w-3 h-3 mr-1.5" />
                            {showRaw ? "See Draft" : "Context Data"}
                        </Button>
                    </div>

                    <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-sm overflow-auto max-h-[400px]">
                        {showRaw ? (
                            <pre className="text-[10px] font-mono text-stone-600 whitespace-pre-wrap">
                                {JSON.stringify(lead, null, 2)}
                            </pre>
                        ) : (
                            <div className={`prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap font-mono ${lead.role_type === 'skipped' ? 'text-red-600' : 'text-stone-600'}`}>
                                {lead.reasoning ? (
                                    lead.reasoning
                                ) : (
                                    <span className="text-stone-400 italic">No analysis details available.</span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex justify-end">
                        <p className="text-[10px] text-stone-400 italic">
                            *Generated based on analysis of {lead.company_name}*
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
