// Client-side session management for anonymous users
const SESSION_KEY = 'sentinel_session_id'

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  let sessionId = localStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem(SESSION_KEY, sessionId)
  }
  return sessionId
}

export function clearSessionId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY)
  }
}

export function mergeScansToUser(userId: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const sessionId = localStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    return null
  }

  // Store that this user's scans should be merged (used to clear session after merge)
  localStorage.setItem(`merge_${userId}`, sessionId)

  return sessionId
}
