import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/core/db/client'
import { Lead } from '@/types/leads'
import { getLeadsByJobId, sortLeads } from '@/services/leads'

/** Database row with joined company data */
interface LeadRow {
    id: string;
    companies?: { name: string; size_bucket: string };
    [key: string]: unknown;
}

/** Realtime payload for lead updates */
interface RealtimePayload {
    new: { id: string };
}

export function useLeads(jobId: string) {
    const [data, setData] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set())
    const [positionChanged, setPositionChanged] = useState<Set<string>>(new Set())
    const previousPositionsRef = useRef<Map<string, number>>(new Map())

    const fetchData = useCallback(async () => {
        if (!jobId) return

        try {
            const leads = await getLeadsByJobId(jobId)
            const sorted = sortLeads(leads)

            // Animation logic: detect position changes
            const newPositions = new Map<string, number>()
            const changedIds = new Set<string>()

            sorted.forEach((lead, index) => {
                newPositions.set(lead.id, index)
                const previousPosition = previousPositionsRef.current.get(lead.id)
                if (previousPositionsRef.current.size > 0 && previousPosition !== undefined && previousPosition !== index) {
                    changedIds.add(lead.id)
                }
            })

            previousPositionsRef.current = newPositions

            if (changedIds.size > 0) {
                setPositionChanged(changedIds)
                setTimeout(() => setPositionChanged(new Set()), 600)
            }

            setData(sorted)
        } catch (error) {
            console.error('Failed to fetch leads:', error)
        } finally {
            setLoading(false)
        }
    }, [jobId])

    useEffect(() => {
        setLoading(true)
        fetchData()

        // Debounced fetch for realtime updates
        let debounceTimer: NodeJS.Timeout
        const debouncedFetch = () => {
            clearTimeout(debounceTimer)
            debounceTimer = setTimeout(fetchData, 500)
        }

        // Subscribe to realtime updates
        const channel = supabase
            .channel('table-updates')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
                const leadId = (payload.new as Record<string, unknown>).id as string
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
            supabase.removeChannel(channel)
            clearTimeout(debounceTimer)
        }
    }, [jobId, fetchData])

    return {
        data,
        loading,
        recentlyUpdated,
        positionChanged,
        refetch: fetchData,
    }
}

