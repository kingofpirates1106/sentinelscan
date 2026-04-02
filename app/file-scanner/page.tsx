'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Upload,
} from 'lucide-react'
import { useSessionId } from '@/hooks/use-session'
import { AuthGuard } from '@/components/auth/auth-guard'

type ScannerTab = 'file' | 'screenshot'
type ThreatLevel = 'safe' | 'suspicious' | 'dangerous' | 'unknown'

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

interface FileScanResult {
  id: string
  fileName: string
  hash: string
  status: 'pending' | 'scanning' | 'completed' | 'failed'
  threat_level?: ThreatLevel
  stats?: ScanStats | null
}

type ReportRiskLevel = 'Safe' | 'Suspicious' | 'Malicious'

interface ScreenshotReport {
  extractedText: string
  threatSummary: string
  riskAnalysis: string
  finalVerdict: ReportRiskLevel
  confidenceScore: number
  riskLevel: ReportRiskLevel
  detectedIndicators: string[]
  highlightedKeywords: string[]
  suspiciousUrls: string[]
  recommendedAction: string
  isScreenshot: boolean
}

interface ScreenshotScanResult {
  id: string
  fileName: string
  status: 'completed'
  threat_level: 'safe' | 'suspicious' | 'dangerous'
  safetyScore: number
  report: ScreenshotReport
}

const SCREENSHOT_TYPES = new Set([
  'image/png',
  'image/jpg',
  'image/jpeg',
  'image/webp',
])

function getThreatColor(level?: string) {
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

function getThreatBg(level?: string) {
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

function getRiskBadgeClass(level: ReportRiskLevel): string {
  if (level === 'Malicious') return 'bg-red-500/20 text-red-300 border border-red-500/40'
  if (level === 'Suspicious') return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
  return 'bg-green-500/20 text-green-300 border border-green-500/40'
}

function getRiskIcon(level: ReportRiskLevel) {
  if (level === 'Malicious') return <ShieldAlert className="h-4 w-4 text-red-400" />
  if (level === 'Suspicious') return <ShieldQuestion className="h-4 w-4 text-yellow-400" />
  return <ShieldCheck className="h-4 w-4 text-green-400" />
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderHighlightedText(text: string, keywords: string[]) {
  if (!text) return <span className="text-neutral-400">No readable text extracted.</span>

  const filteredKeywords = Array.from(
    new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))
  ).sort((a, b) => b.length - a.length)

  if (filteredKeywords.length === 0) {
    return <span>{text}</span>
  }

  const pattern = new RegExp(`(${filteredKeywords.map((keyword) => escapeRegExp(keyword)).join('|')})`, 'gi')
  const segments = text.split(pattern)

  return (
    <>
      {segments.map((segment, index) => {
        const isKeyword = filteredKeywords.some((keyword) => keyword.toLowerCase() === segment.toLowerCase())
        if (!isKeyword) return <span key={`${segment}-${index}`}>{segment}</span>

        return (
          <mark
            key={`${segment}-${index}`}
            className="rounded bg-yellow-500/30 px-1 py-0.5 text-yellow-100"
          >
            {segment}
          </mark>
        )
      })}
    </>
  )
}

function ResultSkeleton() {
  return (
    <div className="p-6 rounded-lg border border-neutral-700 bg-neutral-900/50 animate-pulse space-y-4">
      <div className="h-4 w-28 bg-neutral-800 rounded" />
      <div className="h-4 w-full bg-neutral-800 rounded" />
      <div className="h-3 w-3/4 bg-neutral-800 rounded" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-14 bg-neutral-800 rounded" />
        <div className="h-14 bg-neutral-800 rounded" />
        <div className="h-14 bg-neutral-800 rounded" />
        <div className="h-14 bg-neutral-800 rounded" />
      </div>
    </div>
  )
}

function FileScannerTab({
  sessionId,
}: {
  sessionId: string
}) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanPhase, setScanPhase] = useState<'idle' | 'uploading' | 'queued' | 'scanning'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<FileScanResult | null>(null)
  const [error, setError] = useState('')
  const [limitResetAt, setLimitResetAt] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uploadProgressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
      if (uploadProgressRef.current) clearInterval(uploadProgressRef.current)
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
        return
      }
      setCountdown(formatRemaining(remainingMs))
    }

    tick()
    const intervalId = setInterval(tick, 1000)
    return () => clearInterval(intervalId)
  }, [limitResetAt])

  const startUploadProgress = () => {
    setUploadProgress(5)
    if (uploadProgressRef.current) clearInterval(uploadProgressRef.current)
    uploadProgressRef.current = setInterval(() => {
      setUploadProgress((prev) => (prev >= 90 ? prev : prev + 5))
    }, 250)
  }

  const stopUploadProgress = () => {
    if (uploadProgressRef.current) {
      clearInterval(uploadProgressRef.current)
      uploadProgressRef.current = null
    }
    setUploadProgress(100)
  }

  const startPolling = (scanId: string, seedScan: FileScanResult) => {
    let attempts = 0

    const pollStatus = async () => {
      attempts += 1
      if (attempts > 150) {
        setLoading(false)
        setScanPhase('idle')
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
          setScanPhase('idle')
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
          setScanPhase('idle')
          return
        }

        setScanPhase('scanning')
        setResult((prev) => ({ ...(prev ?? seedScan), status: 'scanning' }))
        pollTimeoutRef.current = setTimeout(pollStatus, 2000)
      } catch {
        setLoading(false)
        setScanPhase('idle')
        setResult({ ...seedScan, status: 'failed' })
        setError('Failed to poll scan status.')
      }
    }

    pollTimeoutRef.current = setTimeout(pollStatus, 2000)
  }

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }

    setLoading(true)
    setScanPhase('uploading')
    setError('')
    setResult(null)
    setLimitResetAt(null)
    setCountdown(null)
    startUploadProgress()

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/scan-file', {
        method: 'POST',
        headers: {
          'x-session-id': sessionId,
        },
        body: formData,
      })

      stopUploadProgress()
      const data = (await response.json()) as any

      if (!response.ok) {
        setError(data.error || 'Scan failed')
        setScanPhase('idle')
        setLoading(false)
        if (data.limitReached && data.resetAt) {
          setLimitResetAt(data.resetAt)
        }
        return
      }

      setResult(data.scan)

      if (data.scan.status === 'completed') {
        setLoading(false)
        setScanPhase('idle')
        return
      }

      setScanPhase('queued')
      startPolling(data.scan.id, data.scan)
    } catch {
      stopUploadProgress()
      setError('Failed to scan file')
      setLoading(false)
      setScanPhase('idle')
    }
  }

  const hasStats = Boolean(result?.stats && result.stats.total > 0)

  return (
    <div className="space-y-6">
      <form onSubmit={handleScan} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">File to scan</label>
          <div className="relative border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center hover:border-neutral-500 transition cursor-pointer">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {file ? (
              <div className="space-y-2">
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-sm text-neutral-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-white font-medium">Drop file here or click to browse</p>
                <p className="text-sm text-neutral-400">Max 128 MB</p>
              </div>
            )}
          </div>
        </div>

        {loading && scanPhase === 'uploading' && (
          <div className="space-y-2">
            <div className="h-2 rounded bg-neutral-800 overflow-hidden">
              <div className="h-full bg-cyan-400 transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-neutral-400">Uploading... {uploadProgress}%</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
            {limitResetAt && countdown && (
              <p className="text-neutral-200 mt-2">Resets in: {countdown}</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file}
          className="w-full px-6 py-3 rounded bg-white text-black hover:bg-neutral-200 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {scanPhase === 'uploading' && 'Uploading file...'}
              {scanPhase === 'queued' && 'Scan queued...'}
              {scanPhase === 'scanning' && 'Scanning with security engines...'}
            </>
          ) : (
            'Scan File'
          )}
        </button>
      </form>

      {loading && !result && <ResultSkeleton />}

      {result && (
        <div className={`p-6 rounded-lg border transition-all duration-500 ${getThreatBg(result.threat_level)}`}>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-neutral-400 mb-2">Scanned File</p>
              <p className="text-white font-mono text-sm break-all">{result.fileName}</p>
              <p className="text-xs text-neutral-500 mt-1">SHA-256: {result.hash}</p>
            </div>

            {result.status === 'completed' && (
              <>
                <p className={`text-lg font-bold ${getThreatColor(result.threat_level)}`}>
                  {result.threat_level?.toUpperCase()}
                </p>
                {hasStats && result.stats && (
                  <div className="pt-4 border-t border-current border-opacity-20 space-y-3">
                    <p className="text-sm font-semibold text-neutral-200">Engine Breakdown</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-neutral-400">Malicious</p>
                        <p className="text-2xl font-bold text-red-500">{result.stats.malicious}</p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-400">Suspicious</p>
                        <p className="text-2xl font-bold text-yellow-500">{result.stats.suspicious}</p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-400">Harmless</p>
                        <p className="text-2xl font-bold text-green-500">{result.stats.harmless}</p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-400">Total Engines</p>
                        <p className="text-2xl font-bold text-white">{result.stats.total}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {(result.status === 'pending' || result.status === 'scanning') && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
                <p className="text-sm text-neutral-400">Analysis in progress...</p>
              </div>
            )}

            {result.status === 'failed' && <p className="text-sm text-red-400">Scan failed. Please retry.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function ScreenshotAnalyzerTab({ sessionId }: { sessionId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [limitResetAt, setLimitResetAt] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [result, setResult] = useState<ScreenshotScanResult | null>(null)

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
        return
      }
      setCountdown(formatRemaining(remainingMs))
    }

    tick()
    const intervalId = setInterval(tick, 1000)
    return () => clearInterval(intervalId)
  }, [limitResetAt])

  const filePreviewUrl = useMemo(() => {
    if (!file || !SCREENSHOT_TYPES.has(file.type.toLowerCase())) return null
    return URL.createObjectURL(file)
  }, [file])

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    }
  }, [filePreviewUrl])

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    const fileType = file.type.toLowerCase()
    if (!SCREENSHOT_TYPES.has(fileType)) {
      setError('Only PNG, JPG, JPEG, and WEBP screenshots are supported.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setLimitResetAt(null)
    setCountdown(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/scan-screenshot', {
        method: 'POST',
        headers: { 'x-session-id': sessionId },
        body: formData,
      })

      const data = (await response.json()) as any
      if (!response.ok) {
        setError(data.error || 'Screenshot analysis failed')
        if (data.limitReached && data.resetAt) {
          setLimitResetAt(data.resetAt)
        }
        setLoading(false)
        return
      }

      setResult(data.scan as ScreenshotScanResult)
      setLoading(false)
    } catch {
      setError('Failed to analyze screenshot')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAnalyze} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-200">Screenshot file</label>
          <div className="relative rounded-xl border-2 border-dashed border-neutral-700 p-8 text-center transition hover:border-neutral-500">
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800">
              <Upload className="h-5 w-5 text-neutral-300" />
            </div>
            {file ? (
              <div className="space-y-1">
                <p className="font-medium text-white">{file.name}</p>
                <p className="text-xs text-neutral-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-medium text-white">Drop screenshot here or click to browse</p>
                <p className="text-xs text-neutral-400">PNG, JPG, JPEG, WEBP up to 10MB</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
            {limitResetAt && countdown && <p className="mt-2 text-neutral-200">Resets in: {countdown}</p>}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing screenshot...
            </>
          ) : (
            'Analyze Screenshot'
          )}
        </button>
      </form>

      {filePreviewUrl && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
          <p className="mb-3 text-sm text-neutral-300">Uploaded Screenshot Preview</p>
          <img
            src={filePreviewUrl}
            alt={file?.name ?? 'Uploaded screenshot'}
            className="max-h-[360px] w-full rounded-xl border border-neutral-800 object-contain bg-black"
          />
        </div>
      )}

      {result && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-[0_14px_38px_rgba(0,0,0,0.35)]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Screenshot Analysis Report</h2>
              <p className="text-sm text-neutral-400">{result.fileName}</p>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${getRiskBadgeClass(result.report.finalVerdict)}`}>
              {getRiskIcon(result.report.finalVerdict)}
              {result.report.finalVerdict}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Threat Summary</p>
              <p className="mt-2 text-sm text-neutral-200">{result.report.threatSummary}</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Confidence Score</p>
              <p className="mt-2 text-2xl font-semibold text-white">{result.report.confidenceScore}%</p>
              <p className="mt-1 text-xs text-neutral-500">Safety score: {result.safetyScore}/100</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Extracted Text</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-200">
              {renderHighlightedText(result.report.extractedText, result.report.highlightedKeywords)}
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Risk Analysis</p>
            <p className="mt-2 text-sm text-neutral-200">{result.report.riskAnalysis}</p>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Detected Indicators</p>
            <ul className="mt-2 space-y-1 text-sm text-neutral-200">
              {result.report.detectedIndicators.map((indicator, idx) => (
                <li key={`${indicator}-${idx}`}>- {indicator}</li>
              ))}
            </ul>
          </div>

          {result.report.suspiciousUrls.length > 0 && (
            <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Suspicious URLs</p>
              <ul className="mt-2 space-y-1 break-all text-sm text-neutral-200">
                {result.report.suspiciousUrls.map((url, idx) => (
                  <li key={`${url}-${idx}`}>- {url}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Recommended Action</p>
            <p className="mt-2 text-sm text-neutral-200">{result.report.recommendedAction}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function UnifiedFileScannerPage() {
  const [activeTab, setActiveTab] = useState<ScannerTab>('file')
  const sessionId = useSessionId()

  return (
    <AuthGuard loadingText="Checking scanner access...">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">File & Screenshot Scanner</h1>
            <p className="text-neutral-400">
              Scan uploaded files for malware and analyze screenshots for phishing and social-engineering threats.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-neutral-800 bg-neutral-900/70 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === 'file'
                  ? 'bg-white text-black'
                  : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              File Scanner
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('screenshot')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === 'screenshot'
                  ? 'bg-white text-black'
                  : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              Screenshot Analyzer
            </button>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.3)]">
            {activeTab === 'file' ? (
              <FileScannerTab sessionId={sessionId} />
            ) : (
              <ScreenshotAnalyzerTab sessionId={sessionId} />
            )}
          </div>

        </div>
      </div>
    </AuthGuard>
  )
}


