'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { HistoryClient } from '@/components/history-client'
import { AuthGuard } from '@/components/auth/auth-guard'
import { createClient } from '@/lib/supabase/client'
import type { ScanHistoryFilter, ScanHistoryItem } from '@/lib/scan-history'

const PAGE_SIZE = 10
const VALID_FILTERS: ScanHistoryFilter[] = ['all', 'url', 'file', 'screenshot']

interface HistoryState {
  scans: ScanHistoryItem[]
  total: number
  page: number
  totalPages: number
  filter: ScanHistoryFilter
}

export default function HistoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [historyState, setHistoryState] = useState<HistoryState>({
    scans: [],
    total: 0,
    page: 1,
    totalPages: 1,
    filter: 'all',
  })

  const page = useMemo(() => {
    const raw = searchParams.get('page') ?? '1'
    return Math.max(1, parseInt(raw, 10) || 1)
  }, [searchParams])

  const filter = useMemo(() => {
    const raw = searchParams.get('filter') ?? 'all'
    return (VALID_FILTERS.includes(raw as ScanHistoryFilter) ? raw : 'all') as ScanHistoryFilter
  }, [searchParams])

  useEffect(() => {
    let isMounted = true

    const loadHistory = async () => {
      setLoading(true)

      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted) return

      if (!session?.user) {
        setLoading(false)
        router.replace('/auth?mode=login')
        return
      }

      let query = supabase
        .from('scans')
        .select('id, scan_type, target_value, risk_level, created_at', { count: 'exact' })
        .eq('user_id', session.user.id)
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false })

      if (filter === 'url') query = query.eq('scan_type', 'url')
      if (filter === 'file') query = query.eq('scan_type', 'file')
      if (filter === 'screenshot') query = query.eq('scan_type', 'screenshot')

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, count, error } = await query.range(from, to)

      if (!isMounted) return

      if (error) {
        console.error('Failed to load history:', error)
        setHistoryState({
          scans: [],
          total: 0,
          page: 1,
          totalPages: 1,
          filter,
        })
        setLoading(false)
        return
      }

      const total = count ?? 0
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

      setHistoryState({
        scans: (data as ScanHistoryItem[]) ?? [],
        total,
        page,
        totalPages,
        filter,
      })
      setLoading(false)
    }

    loadHistory()

    return () => {
      isMounted = false
    }
  }, [filter, page, router])

  return (
    <AuthGuard loadingText="Checking scan history access...">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Scan History</h1>
              <p className="text-neutral-400">All your scans with pagination</p>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-cyan-300 hover:text-cyan-200 transition"
            >
              ? Dashboard
            </Link>
          </div>

          {loading ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-8 text-center">
              <div className="w-10 h-10 rounded-full border-2 border-neutral-800 border-t-white animate-spin mx-auto" />
              <p className="mt-4 text-neutral-400">Loading scan history...</p>
            </div>
          ) : (
            <HistoryClient
              initialScans={historyState.scans}
              initialTotal={historyState.total}
              initialPage={historyState.page}
              initialTotalPages={historyState.totalPages}
              initialFilter={historyState.filter}
            />
          )}
        </div>
      </div>
    </AuthGuard>
  )
}

