'use client'

import { useEffect, useState } from 'react'

const SESSION_KEY = 'sentinel_session_id'

export function useSessionId() {
  const [sessionId, setSessionId] = useState<string>('')

  useEffect(() => {
    // Get or create session ID
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem(SESSION_KEY, id)
    }
    setSessionId(id)
  }, [])

  return sessionId
}

export function clearSessionId() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY)
  }
}

export function mergeScansToUser(userId: string) {
  // This will be called after successful login to merge anonymous scans
  const sessionId = localStorage.getItem(SESSION_KEY)
  return sessionId
}
