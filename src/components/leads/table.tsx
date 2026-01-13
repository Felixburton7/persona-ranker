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
import { DEFAULT_PAGE_SIZE } from "@/core/constants"
import styles from "./table.module.css"

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
                pageSize: DEFAULT_PAGE_SIZE,
            },
        },
        state: {
            sorting,
            expanded,
        },
    })

    /**
     * Handles keyboard navigation for table rows.
     * Allows Enter and Space to toggle row expansion.
     */
    const handleRowKeyDown = React.useCallback((
        event: React.KeyboardEvent<HTMLTableRowElement>,
        toggleExpanded: () => void
    ) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggleExpanded()
        }
    }, [])

    /**
     * Builds the CSS class names for a row based on its state.
     */
    const getRowClassName = React.useCallback((
        lead: Lead,
        isExpanded: boolean,
        isRecentlyUpdated: boolean,
        hasPositionChanged: boolean
    ): string => {
        const isRanked = lead.rank_within_company != null && lead.rank_within_company >= 1
        const isSkipped = lead.role_type === 'skipped'

        const classNames = [styles.leadRow]

        if (isRecentlyUpdated) classNames.push(styles.leadRowUpdated)
        if (hasPositionChanged) classNames.push(styles.leadRowPositionChanged)
        if (isRanked) classNames.push(styles.leadRowRanked)
        if (isSkipped) classNames.push(styles.leadRowSkipped)
        if (isExpanded) classNames.push(styles.leadRowExpanded)

        return classNames.join(' ')
    }, [])

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Ranking Results</h2>
                <div className="flex gap-2">
                    <ExportDialog jobId={jobId} />
                </div>
            </div>

            <div
                className="rounded-md border bg-white shadow-sm overflow-hidden"
                role="region"
                aria-label="Leads ranking results"
            >
                <div className={`${styles.tableContainer} ${styles.customScrollbar}`}>
                    <table
                        className="w-full text-sm text-left caption-bottom"
                        role="grid"
                        aria-describedby="table-description"
                    >
                        <caption id="table-description" className="sr-only">
                            Leads ranking results table. Click on a row to expand for more details.
                        </caption>
                        <thead className={styles.tableHeader}>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id} role="row">
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className={styles.headerCell}
                                            scope="col"
                                            aria-sort={
                                                header.column.getIsSorted()
                                                    ? header.column.getIsSorted() === 'asc'
                                                        ? 'ascending'
                                                        : 'descending'
                                                    : undefined
                                            }
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => {
                                    const lead = row.original
                                    const isExpanded = row.getIsExpanded()
                                    const isRecentlyUpdated = recentlyUpdated.has(lead.id)
                                    const hasPositionChanged = positionChanged.has(lead.id)

                                    return (
                                        <React.Fragment key={row.id}>
                                            <tr
                                                onClick={() => row.toggleExpanded()}
                                                onKeyDown={(e) => handleRowKeyDown(e, row.toggleExpanded)}
                                                className={`border-b ${getRowClassName(lead, isExpanded, isRecentlyUpdated, hasPositionChanged)}`}
                                                data-state={row.getIsSelected() && "selected"}
                                                tabIndex={0}
                                                role="row"
                                                aria-expanded={isExpanded}
                                                aria-label={`Lead: ${lead.full_name}, ${lead.title}`}
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <td key={cell.id} className={styles.tableCell} role="gridcell">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                            {isExpanded && (
                                                <tr className={styles.expandedRow} role="row">
                                                    <td colSpan={columns.length} className={styles.expandedContent} role="gridcell">
                                                        <ExpandedLeadView lead={lead} />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                            ) : (
                                <tr role="row">
                                    <td colSpan={columns.length} className={styles.emptyState} role="gridcell">
                                        {loading ? "Loading results..." : "No results."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-between py-4" role="navigation" aria-label="Table pagination">
                <div className="text-xs text-muted-foreground" aria-live="polite">
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        aria-label="Go to previous page"
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        aria-label="Go to next page"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}

