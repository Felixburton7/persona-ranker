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
import { Button } from "@/components/ui/button"
import { ExportDialog } from "@/components/leads/export-dialog"
import { Lead } from "@/types/leads"
import { useLeads } from "@/hooks"
import { ExpandedLeadView } from "@/components/leads/expanded-lead-view"

interface LeadsTableProps {
    jobId: string
    columns: ColumnDef<Lead>[]
}

export function LeadsTable({ jobId, columns }: LeadsTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [expanded, setExpanded] = React.useState({})

    // Use custom hook for data logic
    const { data, loading, recentlyUpdated, positionChanged } = useLeads(jobId)

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
                pageSize: 50,
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
                                    const lead = row.original
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
