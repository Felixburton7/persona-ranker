"use client";

import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Download } from "lucide-react"

export function ExportDialog({ jobId }: { jobId: string }) {
    const [loading, setLoading] = useState(false)

    const handleExport = async (topN: number) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/export?job_id=${jobId}&top_n=${topN}`)
            if (res.ok) {
                const blob = await res.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = topN === -1 ? `leads-export-all.csv` : `leads-export-top${topN}.csv`
                a.click()
            } else {
                console.error("Export failed")
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button variant="outline" size="sm" onClick={() => handleExport(-1)} disabled={loading}>
            <Download className="w-4 h-4 mr-2" />
            Export All
        </Button>
    )
}
