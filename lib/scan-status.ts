import { createClient } from '@/lib/supabase/server'
import { TimeoutError, withTimeout } from '@/lib/timeout'

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY!

type ScanStatusResult = {
  httpStatus?: number
  body: Record<string, any>
}

function determineThreatLevel(stats?: {
  harmless?: number
  malicious?: number
  suspicious?: number
  undetected?: number
}): 'safe' | 'suspicious' | 'dangerous' | 'unknown' {
  if (!stats) return 'unknown'
  const malicious = stats.malicious ?? 0
  const suspicious = stats.suspicious ?? 0
  const harmless = stats.harmless ?? 0
  const undetected = stats.undetected ?? 0
  const total = harmless + malicious + suspicious + undetected
  const detectionRatio = total > 0 ? malicious / total : 0

  if (malicious === 0 && suspicious === 0) return 'safe'
  if (detectionRatio < 0.05) return 'suspicious'
  return 'dangerous'
}

function buildStats(stats?: {
  harmless?: number
  malicious?: number
  suspicious?: number
  undetected?: number
}) {
  if (!stats) return null
  const harmless = stats.harmless ?? 0
  const malicious = stats.malicious ?? 0
  const suspicious = stats.suspicious ?? 0
  const undetected = stats.undetected ?? 0
  const total = harmless + malicious + suspicious + undetected
  if (total <= 0) return null
  const percent = (count: number) => Math.round((count / total) * 100)
  return {
    total,
    harmless,
    malicious,
    suspicious,
    undetected,
    harmlessPercent: percent(harmless),
    maliciousPercent: percent(malicious),
    suspiciousPercent: percent(suspicious),
    undetectedPercent: percent(undetected),
  }
}

function normalizeStats(stats: any) {
  return {
    harmless: stats?.harmless || 0,
    malicious: stats?.malicious || 0,
    suspicious: stats?.suspicious || 0,
    undetected: stats?.undetected || 0,
  }
}

async function fetchVirusTotalAnalysis(analysisId: string) {
  return withTimeout(
    async (signal) =>
      fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
        headers: { 'x-apikey': VIRUSTOTAL_API_KEY },
        signal,
      }),
    15_000,
    'virustotal analysis polling'
  )
}

async function fetchVirusTotalHashLookup(hash: string) {
  return withTimeout(
    async (signal) =>
      fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
        headers: { 'x-apikey': VIRUSTOTAL_API_KEY },
        signal,
      }),
    15_000,
    'virustotal hash lookup'
  )
}

export async function getScanStatusById(id: string, sessionId: string | null): Promise<ScanStatusResult> {
  const supabase = await createClient(
    sessionId ? { headers: { 'x-session-id': sessionId } } : undefined
  )

  const [authScanResult, anonymousScanResult] = await Promise.all([
    supabase
      .from('scans')
      .select('id, scan_type, target_value, stats, risk_level, raw_response')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('anonymous_scans')
      .select('id, scan_type, target_value, stats, risk_level, raw_response')
      .eq('id', id)
      .maybeSingle(),
  ])

  let scan = authScanResult.data
  let table: 'scans' | 'anonymous_scans' = 'scans'

  if (!scan) {
    if (!anonymousScanResult.data) {
      return {
        httpStatus: 404,
        body: { error: 'Scan not found', id, status: 'failed' },
      }
    }

    scan = anonymousScanResult.data
    table = 'anonymous_scans'
  }

  if (scan.stats) {
    return {
      body: {
        id: scan.id,
        status: 'completed',
        threatLevel: scan.risk_level,
        stats: buildStats(scan.stats ?? undefined),
      },
    }
  }

  const currentStatus = scan.raw_response?.status
  if (currentStatus === 'failed') {
    return {
      body: {
        id: scan.id,
        status: 'failed',
        error: scan.raw_response?.error_message ?? 'Scan failed',
      },
    }
  }

  const analysisId = scan.raw_response?.analysis_id
  const scanMode = scan.raw_response?.scan_mode

  if (scanMode === 'hash_lookup' && scan.scan_type === 'file') {
    try {
      const hashResponse = await fetchVirusTotalHashLookup(scan.target_value)
      if (hashResponse.status === 404) {
        const { error: updateError } = await supabase
          .from(table)
          .update({
            risk_level: 'unknown',
            raw_response: {
              ...scan.raw_response,
              status: 'completed',
              hash_lookup_found: false,
            },
          })
          .eq('id', scan.id)

        if (updateError) {
          return { httpStatus: 500, body: { id: scan.id, status: 'failed', error: 'Failed to persist scan result' } }
        }

        return {
          body: {
            id: scan.id,
            status: 'completed',
            threatLevel: 'unknown',
            stats: null,
          },
        }
      }

      if (!hashResponse.ok) {
        return { body: { id: scan.id, status: 'scanning' } }
      }

      const vtData = await hashResponse.json()
      const normalizedStats = normalizeStats(
        vtData?.data?.attributes?.last_analysis_stats ?? vtData?.data?.attributes?.stats
      )
      const riskLevel = determineThreatLevel(normalizedStats)

      const { error: updateError } = await supabase
        .from(table)
        .update({
          stats: normalizedStats,
          risk_level: riskLevel,
          raw_response: {
            ...scan.raw_response,
            status: 'completed',
            hash_lookup_found: true,
            hash_lookup_response: vtData,
          },
        })
        .eq('id', scan.id)

      if (updateError) {
        return { httpStatus: 500, body: { id: scan.id, status: 'failed', error: 'Failed to persist scan result' } }
      }

      return {
        body: {
          id: scan.id,
          status: 'completed',
          threatLevel: riskLevel,
          stats: buildStats(normalizedStats),
        },
      }
    } catch (error) {
      if (error instanceof TimeoutError) {
        return { body: { id: scan.id, status: 'scanning' } }
      }
      return { body: { id: scan.id, status: 'scanning' } }
    }
  }

  if (!analysisId || typeof analysisId !== 'string') {
    return { body: { id: scan.id, status: 'pending' } }
  }

  try {
    const analysisResponse = await fetchVirusTotalAnalysis(analysisId)

    if (analysisResponse.status === 429) {
      return { body: { id: scan.id, status: 'scanning' } }
    }

    if (!analysisResponse.ok) {
      if (analysisResponse.status >= 500) {
        return { body: { id: scan.id, status: 'scanning' } }
      }
      return { body: { id: scan.id, status: 'scanning' } }
    }

    const analysisData = await analysisResponse.json()
    const vtStatus = analysisData?.data?.attributes?.status
    if (vtStatus !== 'completed') {
      const { error: updateError } = await supabase
        .from(table)
        .update({
          raw_response: {
            ...scan.raw_response,
            status: 'scanning',
          },
        })
        .eq('id', scan.id)

      if (updateError) {
        return { body: { id: scan.id, status: 'scanning' } }
      }

      return { body: { id: scan.id, status: 'scanning' } }
    }

    const normalizedStats = normalizeStats(analysisData?.data?.attributes?.stats)
    const riskLevel = determineThreatLevel(normalizedStats)

    const { error: updateError } = await supabase
      .from(table)
      .update({
        stats: normalizedStats,
        risk_level: riskLevel,
        raw_response: {
          ...scan.raw_response,
          status: 'completed',
          analysis_id: analysisId,
          analysis_response: analysisData,
        },
      })
      .eq('id', scan.id)

    if (updateError) {
      return {
        httpStatus: 500,
        body: { id: scan.id, status: 'failed', error: 'Failed to persist completed scan status' },
      }
    }

    return {
      body: {
        id: scan.id,
        status: 'completed',
        threatLevel: riskLevel,
        stats: buildStats(normalizedStats),
      },
    }
  } catch (error) {
    if (error instanceof TimeoutError) {
      return { body: { id: scan.id, status: 'scanning' } }
    }

    const { error: updateError } = await supabase
      .from(table)
      .update({
        raw_response: {
          ...scan.raw_response,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Status check failed',
        },
      })
      .eq('id', scan.id)

    if (updateError) {
      return { httpStatus: 500, body: { id: scan.id, status: 'failed', error: 'Failed to update failed scan' } }
    }

    return {
      body: {
        id: scan.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Status check failed',
      },
    }
  }
}
