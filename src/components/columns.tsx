"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

export type Lead = {
    id: string
    full_name: string
    title: string
    title_normalized?: string
    company_name: string // Joined
    company_size: string // Joined
    relevance_score: number
    rank_within_company: number | null
    role_type: string
    is_relevant: boolean
    reasoning: string
}

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
            const score = row.original.relevance_score
            return (
                <div className={`font-medium text-center ${score > 80 ? "text-green-600" : score > 50 ? "text-yellow-600" : "text-gray-400"}`}>
                    {score ?? 0}
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
                {/* <div className="text-xs text-gray-400">{row.original.title_normalized}</div> */}
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

            if (role === 'champion') {
                return (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        Champion
                    </span>
                )
            }

            const colors = {
                influencer: "text-amber-700 ring-amber-600/20",
                irrelevant: "text-gray-600 ring-gray-500/10",
                gatekeeper: "text-orange-700 ring-orange-600/20",
                user: "text-indigo-700 ring-indigo-700/10",
                skipped: "bg-red-50 text-red-700 ring-red-600/20"
            }

            const defaultStyle = "text-gray-600 ring-gray-500/10"
            const style = colors[role as keyof typeof colors] || defaultStyle

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
                    className={`max-w-xs text-xs ${isSkipped ? "text-red-600 font-medium" : "truncate text-muted-foreground"}`}
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
