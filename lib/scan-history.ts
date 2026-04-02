import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 10

export type ScanHistoryFilter = 'all' | 'url' | 'file' | 'screenshot'

export interface ScanHistoryItem {
  id: string
  scan_type: string
  target_value: string
  risk_level: string
  created_at: string
}

export interface ScanHistoryResult {
  scans: ScanHistoryItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getScanHistory(
  userId: string,
  page: number = 1,
  filter: ScanHistoryFilter = 'all'
): Promise<ScanHistoryResult> {
  const supabase = await createClient()

  let query = supabase
    .from('scans')
    .select('id, scan_type, target_value, risk_level, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })

  if (filter === 'url') query = query.eq('scan_type', 'url')
  if (filter === 'file') query = query.eq('scan_type', 'file')
  if (filter === 'screenshot') query = query.eq('scan_type', 'screenshot')

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('getScanHistory error:', error)
    return {
      scans: [],
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE,
      totalPages: 0,
    }
  }

  const total = count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  return {
    scans: (data as ScanHistoryItem[]) ?? [],
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages,
  }
}
