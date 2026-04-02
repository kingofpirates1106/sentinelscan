// Supabase database helper for scan storage
// Handles saving and retrieving scan records from the scans table
// Ensures defensive programming with clear error handling

import { createClient } from '@/lib/supabase/server'

type ScanRiskLevel = 'safe' | 'suspicious' | 'dangerous' | 'unknown'

export interface StoreScanRequest {
  user_id: string | null
  scan_type: 'url' | 'file' | 'screenshot'
  target_value: string
  stats: Record<string, any>
  risk_level: ScanRiskLevel
}

export interface StoredScan extends StoreScanRequest {
  id: string
  created_at: string
}

export async function storeScan(
  request: StoreScanRequest
): Promise<StoredScan | null> {
  try {
    const supabase = await createClient()

    // Defensive check: table should exist, but log if it doesn't
    const { data, error } = await supabase
      .from('scans')
      .insert({
        user_id: request.user_id,
        scan_type: request.scan_type,
        target_value: request.target_value,
        stats: request.stats,
        risk_level: request.risk_level,
      })
      .select()
      .single()

    if (error) {
      console.error('[v0] Supabase scan storage error:', error.message)
      console.error(
        '[v0] Note: Ensure the scans table exists. Run: scripts/004_update_scans_schema.sql'
      )
      return null
    }

    return data as StoredScan
  } catch (err) {
    console.error('[v0] Unexpected error storing scan:', err)
    return null
  }
}

export async function getUserScans(
  userId: string,
  daysBack: number = 15
): Promise<StoredScan[]> {
  try {
    const supabase = await createClient()

    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - daysBack)

    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', dateThreshold.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[v0] Error fetching user scans:', error.message)
      return []
    }

    return data as StoredScan[]
  } catch (err) {
    console.error('[v0] Unexpected error fetching scans:', err)
    return []
  }
}

export async function getAllScans(
  userId: string
): Promise<StoredScan[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[v0] Error fetching all scans:', error.message)
      return []
    }

    return data as StoredScan[]
  } catch (err) {
    console.error('[v0] Unexpected error fetching all scans:', err)
    return []
  }
}

export async function getScanStatistics(userId: string): Promise<{
  total: number
  by_type: { url: number; file: number; screenshot: number }
  by_risk: { safe: number; suspicious: number; dangerous: number; unknown: number }
}> {
  try {
    const scans = await getAllScans(userId)

    return {
      total: scans.length,
      by_type: {
        url: scans.filter((s) => s.scan_type === 'url').length,
        file: scans.filter((s) => s.scan_type === 'file').length,
        screenshot: scans.filter((s) => s.scan_type === 'screenshot').length,
      },
      by_risk: {
        safe: scans.filter((s) => s.risk_level === 'safe').length,
        suspicious: scans.filter((s) => s.risk_level === 'suspicious').length,
        dangerous: scans.filter((s) => s.risk_level === 'dangerous').length,
        unknown: scans.filter((s) => s.risk_level === 'unknown').length,
      },
    }
  } catch (err) {
    console.error('[v0] Error calculating scan statistics:', err)
    return {
      total: 0,
      by_type: { url: 0, file: 0, screenshot: 0 },
      by_risk: { safe: 0, suspicious: 0, dangerous: 0, unknown: 0 },
    }
  }
}
