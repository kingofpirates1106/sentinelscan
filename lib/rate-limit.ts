import { createClient } from '@/lib/supabase/server'

const GUEST_URL_LIMIT = 3
const GUEST_FILE_LIMIT = 2
const AUTHED_DAILY_LIMIT = 100
const WINDOW_HOURS = 24

function sinceHoursAgo(hours: number): string {
  const d = new Date()
  d.setHours(d.getHours() - hours)
  return d.toISOString()
}

export type RateLimitResult =
  | { allowed: true }
  | {
      allowed: false
      error: string
      status: 429
      limitReached?: boolean
      resetAt?: string | null
    }

type ScanType = 'url' | 'file'
type SupportedScanType = ScanType | 'screenshot'

async function consumeScanLimit(
  userId: string | null,
  sessionId: string | null,
  scanType: SupportedScanType
): Promise<RateLimitResult> {
  const supabase = await createClient(
    sessionId ? { headers: { 'x-session-id': sessionId } } : undefined
  )
  const since = sinceHoursAgo(WINDOW_HOURS)

  if (userId) {
    const { count, error: countError } = await supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since)

    if (countError) {
      console.error('[rate-limit] count error (auth):', countError)
      return { allowed: false, error: 'Rate limit check failed', status: 429 }
    }

    if ((count ?? 0) >= AUTHED_DAILY_LIMIT) {
      return {
        allowed: false,
        error: 'Daily scan limit reached (100 per 24 hours).',
        status: 429,
        limitReached: true,
      }
    }

    return { allowed: true }
  }

  if (!sessionId) {
    return { allowed: false, error: 'Session ID required for guest scans', status: 429 }
  }

  const guestLimit = scanType === 'url' ? GUEST_URL_LIMIT : GUEST_FILE_LIMIT
  const guestErrorMessage =
    scanType === 'url'
      ? 'Guest limit: 3 URL scans per 24 hours. Sign in for more.'
      : 'Guest limit: 2 file scans per 24 hours. Sign in for more.'

  const { count, error: countError } = await supabase
    .from('anonymous_scans')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('scan_type', scanType)
    .gt('created_at', since)

  if (countError) {
    console.error('[rate-limit] count error (anon):', countError)
    return { allowed: false, error: 'Rate limit check failed', status: 429 }
  }

  if ((count ?? 0) >= guestLimit) {
    const { data: oldestScan, error: oldestError } = await supabase
      .from('anonymous_scans')
      .select('created_at')
      .eq('session_id', sessionId)
      .eq('scan_type', scanType)
      .gt('created_at', since)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (oldestError) {
      console.error('[rate-limit] oldest scan lookup error (anon):', oldestError)
      return {
        allowed: false,
        error: guestErrorMessage,
        status: 429,
        limitReached: true,
      }
    }

    const resetAt = oldestScan?.created_at
      ? new Date(
          new Date(oldestScan.created_at).getTime() + WINDOW_HOURS * 60 * 60 * 1000
        ).toISOString()
      : null

    return {
      allowed: false,
      error: guestErrorMessage,
      status: 429,
      limitReached: true,
      resetAt,
    }
  }

  return { allowed: true }
}

export async function checkUrlScanLimit(
  userId: string | null,
  sessionId: string | null
): Promise<RateLimitResult> {
  return consumeScanLimit(userId, sessionId, 'url')
}

export async function checkFileScanLimit(
  userId: string | null,
  sessionId: string | null
): Promise<RateLimitResult> {
  return consumeScanLimit(userId, sessionId, 'file')
}

export async function checkScreenshotScanLimit(
  userId: string | null,
  sessionId: string | null
): Promise<RateLimitResult> {
  return consumeScanLimit(userId, sessionId, 'screenshot')
}
