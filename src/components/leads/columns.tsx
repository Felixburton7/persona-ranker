"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Lead } from "@/types/leads"
import { getRoleBadgeStyles, getScoreColor } from "@/core/leads-styling"

export const columns: ColumnDef<Lead>[] = [
    {
        accessorKey: "rank",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Rank
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const rank = row.original.rank_within_company
            if (rank === null || rank === undefined) return <div className="text-center text-stone-300">-</div>
            return <div className="font-bold text-center text-stone-900">#{rank}</div>
        },
        accessorFn: (row) => row.rank_within_company ?? 9999, // Sort nulls last
    },
    {
        accessorKey: "score",
        header: ({ column }) => {
            return (
                <div className="text-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Score
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            )
        },
        cell: ({ row }) => {
            const score = row.original.relevance_score ?? 0
            return (
                <div className={`font-medium text-center ${getScoreColor(score)}`}>
                    {score}
                </div>
            )
        },
        accessorFn: (row) => row.relevance_score ?? 0,
    },
    {
        accessorKey: "full_name",
        header: "Name",
    },
    {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
            <div>
                <div>{row.getValue("title")}</div>
            </div>
        )
    },
    {
        accessorKey: "company_name",
        header: "Company",
        cell: ({ row }) => (
            <div>
                <div className="font-medium">{row.original.company_name}</div>
                <div className="text-xs text-muted-foreground uppercase">{row.original.company_size}</div>
            </div>
        )
    },
    {
        accessorKey: "role_type",
        header: "Role",
        cell: ({ row }) => {
            const role = row.original.role_type
            if (!role) return null;

            if (role === 'decision_maker') {
                return (
                    <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-purple-700">
                        Decision Maker
                    </span>
                )
            }

            // Other roles use shared util
            const style = getRoleBadgeStyles(role)

            return (
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${style}`}>
                    {role.replace(/_/g, " ")}
                </span>
            )
        }
    },
    {
        accessorKey: "reasoning",
        header: "Reasoning",
        cell: ({ row }) => {
            const isSkipped = row.original.role_type === 'skipped';
            return (
                <div
                    className={`max-w-[13rem] text-xs ${isSkipped ? "text-red-600 font-medium" : "truncate text-muted-foreground"}`}
                    title={row.original.reasoning || ""}
                >
                    {row.original.reasoning}
                </div>
            )
        }
    },
    {
        id: "actions",
        cell: ({ row }) => (
            <div className="flex justify-end pr-2">
                <ChevronDown className={`h-4 w-4 text-stone-400 transition-transform duration-200 ${row.getIsExpanded() ? "rotate-180" : ""}`} />
            </div>
        )
    }
]
