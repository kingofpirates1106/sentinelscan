'use client'

import React from 'react'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSessionId } from '@/hooks/use-session'
import { Loader2 } from 'lucide-react'

interface ScanStats {
  total: number
  harmless: number
  malicious: number
  suspicious: number
  undetected: number
  harmlessPercent: number
  maliciousPercent: number
  suspiciousPercent: number
  undetectedPercent: number
}

interface ScanResult {
  id: string
  url: string
  status: 'pending' | 'scanning' | 'completed' | 'failed'
  threat_level?: 'safe' | 'suspicious' | 'dangerous' | 'unknown'
  stats?: ScanStats | null
  securityIssues?: {
    missingHttps?: boolean
  }
}

function ResultSkeleton() {
  return (
    <div className="p-6 rounded-lg border border-neutral-700 bg-neutral-900/50 animate-pulse space-y-4">
      <div className="h-4 w-32 bg-neutral-800 rounded" />
      <div className="h-4 w-full bg-neutral-800 rounded" />
      <div className="h-8 w-24 bg-neutral-800 rounded" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-14 bg-neutral-800 rounded" />
        <div className="h-14 bg-neutral-800 rounded" />
        <div className="h-14 bg-neutral-800 rounded" />
        <div className="h-14 bg-neutral-800 rounded" />
      </div>
    </div>
  )
}

export default function ScanURLPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState('')
  const [statusLabel, setStatusLabel] = useState('')
  const [limitResetAt, setLimitResetAt] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionId = useSessionId()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }
    checkUser()
  }, [])

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!limitResetAt) {
      setCountdown(null)
      return
    }

    const formatRemaining = (ms: number) => {
      const totalSeconds = Math.max(0, Math.floor(ms / 1000))
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }

    const tick = () => {
      const remainingMs = new Date(limitResetAt).getTime() - Date.now()
      if (remainingMs <= 0) {
        setCountdown('00:00:00')
        window.location.reload()
        return
      }
      setCountdown(formatRemaining(remainingMs))
    }

    tick()
    const intervalId = setInterval(tick, 1000)
    return () => clearInterval(intervalId)
  }, [limitResetAt])

  const startPolling = (scanId: string, seedScan: ScanResult) => {
    let attempts = 0

    const pollStatus = async () => {
      attempts += 1
      if (attempts > 150) {
        setLoading(false)
        setStatusLabel('')
        setError('Scan is taking longer than expected. Please try again.')
        return
      }

      try {
        const statusResponse = await fetch(`/api/scan-status?id=${encodeURIComponent(scanId)}`, {
          headers: {
            'x-session-id': sessionId,
          },
        })
        const statusData = (await statusResponse.json()) as any

        if (!statusResponse.ok || statusData.status === 'failed') {
          setResult({ ...seedScan, status: 'failed' })
          setLoading(false)
          setStatusLabel('')
          setError(statusData.error || 'Scan failed during analysis.')
          return
        }

        if (statusData.status === 'completed') {
          setResult({
            ...seedScan,
            ...statusData,
            status: 'completed',
            threat_level: statusData.threatLevel ?? seedScan.threat_level,
            stats: statusData.stats ?? seedScan.stats,
          })
          setLoading(false)
          setStatusLabel('')
          return
        }

        setResult((prev) => ({ ...(prev ?? seedScan), status: 'scanning' }))
        setStatusLabel('Scan started. Running security engine checks...')
        pollTimeoutRef.current = setTimeout(pollStatus, 2000)
      } catch {
        setLoading(false)
        setStatusLabel('')
        setResult({ ...seedScan, status: 'failed' })
        setError('Failed to poll scan status.')
      }
    }

    pollTimeoutRef.current = setTimeout(pollStatus, 2000)
  }

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }

    setLoading(true)
    setError('')
    setResult(null)
    setStatusLabel('Scan started. Submitting URL...')
    setLimitResetAt(null)
    setCountdown(null)

    try {
      const response = await fetch('/api/scan-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({ url }),
      })

      const data = (await response.json()) as any

      if (!response.ok) {
        setError(data.error || 'Scan failed')
        setStatusLabel('')
        setLoading(false)
        if (data.limitReached && data.resetAt) {
          setLimitResetAt(data.resetAt)
        }
        return
      }

      setResult(data.scan)

      if (data.scan.status === 'completed') {
        setStatusLabel(data.cached ? 'Returned from 24-hour cache.' : '')
        setLoading(false)
        return
      }

      startPolling(data.scan.id, data.scan)
    } catch (err) {
      setError('Failed to scan URL')
      setStatusLabel('')
      setLoading(false)
      console.error(err)
    }
  }

  const getThreatColor = (level?: string) => {
    switch (level) {
      case 'dangerous':
        return 'text-red-500'
      case 'suspicious':
        return 'text-yellow-500'
      case 'safe':
        return 'text-green-500'
      default:
        return 'text-neutral-400'
    }
  }

  const getThreatBg = (level?: string) => {
    switch (level) {
      case 'dangerous':
        return 'bg-red-500/10 border-red-500/30'
      case 'suspicious':
        return 'bg-yellow-500/10 border-yellow-500/30'
      case 'safe':
        return 'bg-green-500/10 border-green-500/30'
      default:
        return 'bg-neutral-800/50 border-neutral-700'
    }
  }

  const hasStats = Boolean(result?.stats && result.stats.total > 0)
  const showSecurityObservations = Boolean(result?.securityIssues?.missingHttps)

  const getVerdictExplanation = () => {
    if (!result?.stats) return null
    const total = result.stats.total ?? 0
    const malicious = result.stats.malicious ?? 0
    const suspicious = result.stats.suspicious ?? 0
    const detectionRatio = total > 0 ? malicious / total : 0

    if (malicious === 0 && suspicious === 0) {
      return {
        reason: 'No security engines detected malicious behavior.',
        confidence: 'Low',
        ratioText: `${malicious} / ${total} engines (${Math.round(detectionRatio * 100)}%)`,
      }
    }

    if (detectionRatio < 0.05) {
      return {
        reason: `Detected by ${malicious} engine(s). This may be a false positive.`,
        confidence: 'Low',
        ratioText: `${malicious} / ${total} engines (${Math.round(detectionRatio * 100)}%)`,
      }
    }

    return {
      reason: `Detected by ${malicious} security engines. High confidence malicious detection.`,
      confidence: detectionRatio >= 0.2 ? 'High' : 'Medium',
      ratioText: `${malicious} / ${total} engines (${Math.round(detectionRatio * 100)}%)`,
    }
  }
  const explanation = getVerdictExplanation()

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold">URL Scanner</h1>
              <p className="text-neutral-400">
                Scan any URL for security threats and malware
              </p>
            </div>

            <form onSubmit={handleScan} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">URL to scan</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 rounded bg-neutral-900 border border-neutral-700 focus:border-neutral-500 focus:outline-none text-white placeholder-neutral-600"
                  required
                />
              </div>

              {error && (
                <div className="p-4 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                  {limitResetAt && countdown && (
                    <p className="text-neutral-200 mt-2">Resets in: {countdown}</p>
                  )}
                </div>
              )}

              {loading && statusLabel && (
                <div className="p-3 rounded border border-neutral-700 bg-neutral-900/50 text-sm text-neutral-300 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{statusLabel}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 rounded bg-white text-black hover:bg-neutral-200 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  'Scan URL'
                )}
              </button>
            </form>

            {loading && !result && <ResultSkeleton />}

            {result && (
              <div className={`p-6 rounded-lg border ${getThreatBg(result.threat_level)}`}>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-neutral-400 mb-2">Scanned URL</p>
                    <p className="text-white break-all font-mono text-sm">{result.url}</p>
                  </div>

                  {result.status === 'completed' && (
                    <>
                      <div>
                        <p className={`text-lg font-bold ${getThreatColor(result.threat_level)}`}>
                          {result.threat_level?.toUpperCase()}
                        </p>
                      </div>

                      {hasStats && result.stats && (
                        <div className="pt-4 border-t border-current border-opacity-20 space-y-3">
                          <p className="text-sm font-semibold text-neutral-200">Engine Breakdown</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-neutral-400">Malicious</p>
                              <p className="text-2xl font-bold text-red-500">
                                {result.stats.malicious} <span className="text-sm text-neutral-400">({result.stats.maliciousPercent}%)</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-neutral-400">Suspicious</p>
                              <p className="text-2xl font-bold text-yellow-500">
                                {result.stats.suspicious} <span className="text-sm text-neutral-400">({result.stats.suspiciousPercent}%)</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-neutral-400">Harmless</p>
                              <p className="text-2xl font-bold text-green-500">
                                {result.stats.harmless} <span className="text-sm text-neutral-400">({result.stats.harmlessPercent}%)</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-neutral-400">Total Engines</p>
                              <p className="text-2xl font-bold text-white">{result.stats.total}</p>
                            </div>
                            <div>
                              <p className="text-sm text-neutral-400">Undetected</p>
                              <p className="text-2xl font-bold text-neutral-400">
                                {result.stats.undetected} <span className="text-sm text-neutral-400">({result.stats.undetectedPercent}%)</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {explanation && (
                        <div className="pt-4 border-t border-current border-opacity-20">
                          <p className="text-sm text-neutral-300">
                            Detection Ratio: <span className="text-white">{explanation.ratioText}</span>
                          </p>
                          <p className="text-sm text-neutral-300 mt-1">
                            Confidence Level: <span className="text-white">{explanation.confidence}</span>
                          </p>
                          <p className="text-sm text-neutral-300 mt-1">
                            Why this result: {explanation.reason}
                          </p>
                        </div>
                      )}

                      {showSecurityObservations && (
                        <div className="pt-4 border-t border-current border-opacity-20 space-y-2">
                          <p className="text-sm font-semibold text-neutral-200">Security Observations</p>
                          {result.securityIssues?.missingHttps && (
                            <p className="text-sm text-yellow-400">
                              This URL does not use HTTPS. Traffic may be unencrypted.
                            </p>
                          )}
                        </div>
                      )}

                    </>
                  )}

                  {(result.status === 'pending' || result.status === 'scanning') && (
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <p>Analysis in progress...</p>
                    </div>
                  )}

                  {result.status === 'failed' && (
                    <p className="text-sm text-red-400">Scan failed. Please retry.</p>
                  )}
                </div>
              </div>
            )}

            {!user && (
              <div className="p-4 rounded border border-neutral-700 bg-neutral-900/50 space-y-3">
                <p className="text-sm text-neutral-400">
                  Sign up to get unlimited scans and track your scan history
                </p>
                {limitResetAt && countdown && (
                  <p className="text-sm text-yellow-300">
                    Guest limit reached. Resets in: {countdown}
                  </p>
                )}
                <Link
                  href="/auth/sign-up"
                  className="inline-block px-4 py-2 rounded bg-white text-black hover:bg-neutral-200 transition font-medium text-sm"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
