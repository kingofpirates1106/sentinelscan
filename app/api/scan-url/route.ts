import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { checkUrlScanLimit } from '@/lib/rate-limit'
import { createHash, randomUUID } from 'crypto'
import { isIP } from 'net'
import { TimeoutError, withTimeout } from '@/lib/timeout'

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY!
const IS_DEV = process.env.NODE_ENV !== 'production'

async function submitUrlAnalysis(url: string) {
  const formData = new FormData()
  formData.append('url', url)

  const submitResponse = await withTimeout(
    async (signal) =>
      fetch('https://www.virustotal.com/api/v3/urls', {
        method: 'POST',
        headers: {
          'x-apikey': VIRUSTOTAL_API_KEY,
        },
        body: formData,
        signal,
      }),
    15_000,
    'virustotal url submission'
  )

  if (!submitResponse.ok) {
    throw new Error('Failed to submit URL to VirusTotal')
  }

  const submitData = await submitResponse.json()
  const analysisId = submitData?.data?.id

  if (!analysisId) {
    throw new Error('No analysis ID returned from VirusTotal')
  }

  return {
    status: 'pending' as const,
    analysisId,
    raw: submitData,
  }
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

function hashNormalizedUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex')
}

function isPrivateIp(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    return true
  }

  const ipType = isIP(hostname)
  if (ipType === 4) {
    const parts = hostname.split('.').map((part) => Number(part))
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true
    if (parts[0] === 10) return true
    if (parts[0] === 127) return true
    if (parts[0] === 192 && parts[1] === 168) return true
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    return false
  }

  if (ipType === 6) {
    const normalized = hostname.toLowerCase()
    if (normalized === '::1') return true
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
    if (normalized.startsWith('fe80')) return true
    return false
  }

  return false
}

function isValidHostname(hostname: string): boolean {
  const ipType = isIP(hostname)
  if (ipType !== 0) return true

  const labels = hostname.split('.')
  if (labels.length < 2) return false
  return labels.every((label) => {
    if (!label || label.length > 63) return false
    if (label.startsWith('-') || label.endsWith('-')) return false
    return /^[a-z0-9-]+$/i.test(label)
  })
}

function validateUrlInput(rawUrl: string): {
  normalizedUrl?: string
  error?: string
  securityIssues: { missingHttps?: boolean }
} {
  const securityIssues: { missingHttps?: boolean } = {}

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { error: 'Invalid URL format', securityIssues }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { error: 'Only HTTP and HTTPS URLs are supported', securityIssues }
  }

  if (!isValidHostname(parsed.hostname)) {
    return { error: 'Invalid domain format', securityIssues }
  }

  if (isPrivateIp(parsed.hostname)) {
    return { error: 'Private or localhost addresses are not allowed', securityIssues }
  }

  if (parsed.protocol !== 'https:') {
    securityIssues.missingHttps = true
  }

  return { normalizedUrl: parsed.toString(), securityIssues }
}

async function findCachedUrlScan(normalizedUrl: string) {
  const supabaseAdmin = createAdminClient()
  const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [authCacheResult, anonCacheResult] = await Promise.all([
    supabaseAdmin
      .from('scans')
      .select('id, stats, risk_level, created_at')
      .eq('scan_type', 'url')
      .eq('target_value', normalizedUrl)
      .not('stats', 'is', null)
      .gte('created_at', threshold)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('anonymous_scans')
      .select('id, stats, risk_level, created_at')
      .eq('scan_type', 'url')
      .eq('target_value', normalizedUrl)
      .not('stats', 'is', null)
      .gte('created_at', threshold)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const authRow = authCacheResult.data
  const anonRow = anonCacheResult.data
  if (!authRow && !anonRow) return null

  const winner =
    authRow && anonRow
      ? new Date(authRow.created_at).getTime() >= new Date(anonRow.created_at).getTime()
        ? authRow
        : anonRow
      : authRow ?? anonRow

  return {
    id: winner!.id,
    threatLevel: winner!.risk_level ?? determineThreatLevel(winner!.stats ?? undefined),
    stats: buildStats(winner!.stats ?? undefined),
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    const validation = validateUrlInput(url)
    if (validation.error || !validation.normalizedUrl) {
      return NextResponse.json(
        { error: validation.error ?? 'Invalid URL format' },
        { status: 400 }
      )
    }

    const rawSessionId = request.headers.get('x-session-id')
    const authClient = await createClient()

    const {
      data: { user },
    } = await authClient.auth.getUser()

    let sessionId = rawSessionId
    if (!user && (!sessionId || sessionId.trim().length === 0)) {
      sessionId = `anon_${randomUUID()}`
    }

    const supabase = await createClient(
      sessionId ? { headers: { 'x-session-id': sessionId } } : undefined
    )

    const [cachedScan, limitResult] = await Promise.all([
      findCachedUrlScan(validation.normalizedUrl),
      checkUrlScanLimit(user?.id ?? null, sessionId),
    ])

    if (cachedScan) {
      return NextResponse.json({
        success: true,
        cached: true,
        scan: {
          id: cachedScan.id,
          url: validation.normalizedUrl,
          urlHash: hashNormalizedUrl(validation.normalizedUrl),
          status: 'completed',
          threat_level: cachedScan.threatLevel,
          threatLevel: cachedScan.threatLevel,
          stats: cachedScan.stats,
          securityIssues: validation.securityIssues,
        },
      })
    }

    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: limitResult.error,
          limitReached: limitResult.limitReached ?? false,
          resetAt: limitResult.resetAt ?? null,
        },
        { status: limitResult.status }
      )
    }

    const submitResult = await submitUrlAnalysis(validation.normalizedUrl)

    let scanId = randomUUID()
    const createdAt = new Date().toISOString()
    const rawResponse = {
      status: 'pending',
      analysis_id: submitResult.analysisId,
      submit_response: submitResult.raw ?? null,
      scan_mode: 'url',
      url_hash: hashNormalizedUrl(validation.normalizedUrl),
      security_issues: validation.securityIssues,
    }

    if (user) {
      const { data, error } = await supabase
        .from('scans')
        .insert({
          id: scanId,
          user_id: user.id,
          scan_type: 'url',
          target_value: validation.normalizedUrl,
          stats: null,
          risk_level: 'unknown',
          raw_response: rawResponse,
          created_at: createdAt,
        })
        .select('id')
        .single()

      if (error) {
        console.error('[scan-url] DB insert error (scans):', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId: user.id,
          target: validation.normalizedUrl,
        })
        return NextResponse.json(
          {
            error: 'Failed to store scan result',
            ...(IS_DEV
              ? {
                  backend: {
                    source: 'scans_insert',
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                  },
                }
              : {}),
          },
          { status: 500 }
        )
      }

      scanId = data.id
    } else {
      const { data, error } = await supabase
        .from('anonymous_scans')
        .insert({
          id: scanId,
          session_id: sessionId,
          scan_type: 'url',
          target_value: validation.normalizedUrl,
          stats: null,
          risk_level: 'unknown',
          raw_response: rawResponse,
          created_at: createdAt,
        })
        .select('id')
        .single()

      if (error) {
        console.error('[scan-url] DB insert error (anonymous_scans):', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          sessionId,
          target: validation.normalizedUrl,
        })
        return NextResponse.json(
          {
            error: 'Failed to store scan result',
            ...(IS_DEV
              ? {
                  backend: {
                    source: 'anonymous_scans_insert',
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                  },
                }
              : {}),
          },
          { status: 500 }
        )
      }

      scanId = data.id
    }

    return NextResponse.json({
      success: true,
      scan: {
        id: scanId,
        url: validation.normalizedUrl,
        urlHash: hashNormalizedUrl(validation.normalizedUrl),
        status: 'pending',
        analysisId: submitResult.analysisId,
        threat_level: 'unknown',
        threatLevel: 'unknown',
        stats: null,
        securityIssues: validation.securityIssues,
      },
    })
  } catch (error) {
    console.error('[scan-url] Scan error:', error)
    const isTimeout = error instanceof TimeoutError
    return NextResponse.json(
      {
        error: isTimeout ? 'URL scan request timed out. Please retry.' : 'Failed to scan URL',
        ...(IS_DEV
          ? {
              backend: {
                message: error instanceof Error ? error.message : String(error),
              },
            }
          : {}),
      },
      { status: 500 }
    )
  }
}
