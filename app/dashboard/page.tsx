'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { Toaster, toast } from 'sonner'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { FileText, ImageIcon, Link2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthGuard } from '@/components/auth/auth-guard'
import { WelcomePopup } from '@/components/welcome-popup'

type ScanType = 'url' | 'file' | 'screenshot'
type RiskLevel = 'safe' | 'suspicious' | 'dangerous' | 'unknown'
type PlanTier = 'anonymous' | 'free' | 'pro'

interface Scan {
  id: string
  scan_type: ScanType
  target_value: string
  risk_level: RiskLevel
  created_at: string
}

interface DashboardStats {
  totalScans: number
  urlScans: number
  fileScans: number
  screenshotScans: number
  safeScans: number
  suspiciousScans: number
  dangerousScans: number
  threatsDetected: number
}

interface TrendPoint {
  dateKey: string
  dateLabel: string
  score: number | null
}

function getDisplayName(user: User): string {
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const directName =
    typeof metadata?.name === 'string'
      ? metadata.name
      : typeof metadata?.full_name === 'string'
        ? metadata.full_name
        : typeof metadata?.user_name === 'string'
          ? metadata.user_name
          : ''

  if (directName.trim().length > 0) return directName.trim()
  if (user.email) return user.email.split('@')[0]
  return 'there'
}

function getPlanTier(user: User | null): PlanTier {
  if (!user) return 'anonymous'

  const appMeta = user.app_metadata as Record<string, unknown> | undefined
  const userMeta = user.user_metadata as Record<string, unknown> | undefined
  const planRaw = (appMeta?.plan ?? userMeta?.plan ?? 'free') as string
  const normalized = planRaw.toLowerCase()
  if (normalized === 'pro') return 'pro'
  return 'free'
}

function getDailyQuota(plan: PlanTier): number {
  if (plan === 'anonymous') return 3
  if (plan === 'pro') return 250
  return 25
}

function getRiskScore(level: RiskLevel): number {
  if (level === 'safe') return 100
  if (level === 'suspicious') return 45
  if (level === 'dangerous') return 0
  return 70
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function buildTrendData(scans: Scan[]): TrendPoint[] {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 14)
  start.setHours(0, 0, 0, 0)

  const buckets = new Map<string, { sum: number; count: number }>()

  for (const scan of scans) {
    const date = new Date(scan.created_at)
    const key = formatDateKey(date)
    const existing = buckets.get(key) ?? { sum: 0, count: 0 }
    existing.sum += getRiskScore(scan.risk_level)
    existing.count += 1
    buckets.set(key, existing)
  }

  const points: TrendPoint[] = []
  for (let i = 0; i < 15; i += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    const key = formatDateKey(day)
    const bucket = buckets.get(key)
    points.push({
      dateKey: key,
      dateLabel: formatDateLabel(day),
      score: bucket ? Number((bucket.sum / bucket.count).toFixed(1)) : null,
    })
  }

  return points
}

function useCountUp(target: number, durationMs: number = 900): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let frame = 0
    let start = 0

    const step = (timestamp: number) => {
      if (start === 0) start = timestamp
      const progress = Math.min((timestamp - start) / durationMs, 1)
      const next = Math.round(progress * target)
      setValue(next)
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    setValue(0)
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [durationMs, target])

  return value
}

function CounterCard({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint?: string
}) {
  const animated = useCountUp(value)
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{animated}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [userName, setUserName] = useState('there')
  const [isFirstLogin, setIsFirstLogin] = useState(false)
  const [showWelcomePopup, setShowWelcomePopup] = useState(false)
  const [scans15Days, setScans15Days] = useState<Scan[]>([])
  const [activityFeed, setActivityFeed] = useState<Scan[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalScans: 0,
    urlScans: 0,
    fileScans: 0,
    screenshotScans: 0,
    safeScans: 0,
    suspiciousScans: 0,
    dangerousScans: 0,
    threatsDetected: 0,
  })
  const [todayUsage, setTodayUsage] = useState(0)

  const router = useRouter()
  const searchParams = useSearchParams()
  const hasShownAuthToast = useRef(false)

  const planTier = getPlanTier(user)
  const dailyQuota = getDailyQuota(planTier)
  const usageRatio = dailyQuota > 0 ? Math.min(todayUsage / dailyQuota, 1) : 0
  const usagePercent = Math.round(usageRatio * 100)
  const usageBarColor =
    usagePercent > 90
      ? 'bg-red-500'
      : usagePercent >= 70
        ? 'bg-yellow-500'
        : 'bg-green-500'

  const trendData = useMemo(() => buildTrendData(scans15Days), [scans15Days])

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        setLoading(false)
        router.replace('/auth?mode=login')
        return
      }

      setUser(authUser)
      setUserName(getDisplayName(authUser))

      const createdAtMs = new Date(authUser.created_at).getTime()
      const isNewByCreatedAt = Date.now() - createdAtMs <= 2 * 60 * 1000
      setIsFirstLogin(isNewByCreatedAt)

      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)

      const [
        scans15DaysResult,
        recentActivityResult,
        totalCountResult,
        urlCountResult,
        fileCountResult,
        screenshotCountResult,
        threatCountResult,
        safeCountResult,
        suspiciousCountResult,
        dangerousCountResult,
        todayUsageResult,
      ] = await Promise.all([
        supabase
          .from('scans')
          .select('id, scan_type, target_value, risk_level, created_at')
          .eq('user_id', authUser.id)
          .gte('created_at', fifteenDaysAgo)
          .order('created_at', { ascending: false }),
        supabase
          .from('scans')
          .select('id, scan_type, target_value, risk_level, created_at')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', authUser.id),
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', authUser.id)
          .eq('scan_type', 'url'),
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', authUser.id)
          .eq('scan_type', 'file'),
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', authUser.id)
          .eq('scan_type', 'screenshot'),
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', authUser.id)
          .in('risk_level', ['suspicious', 'dangerous']),
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', authUser.id)
          .eq('risk_level', 'safe'),
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', authUser.id)
          .eq('risk_level', 'suspicious'),
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', authUser.id)
          .eq('risk_level', 'dangerous'),
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', authUser.id)
          .gte('created_at', startOfToday.toISOString()),
      ])

      if (scans15DaysResult.error) {
        console.error('Error loading 15-day scans:', scans15DaysResult.error)
      } else {
        setScans15Days((scans15DaysResult.data as Scan[]) ?? [])
      }

      if (recentActivityResult.error) {
        console.error('Error loading activity feed:', recentActivityResult.error)
      } else {
        setActivityFeed((recentActivityResult.data as Scan[]) ?? [])
      }

      setStats({
        totalScans: totalCountResult.count ?? 0,
        urlScans: urlCountResult.count ?? 0,
        fileScans: fileCountResult.count ?? 0,
        screenshotScans: screenshotCountResult.count ?? 0,
        safeScans: safeCountResult.count ?? 0,
        suspiciousScans: suspiciousCountResult.count ?? 0,
        dangerousScans: dangerousCountResult.count ?? 0,
        threatsDetected: threatCountResult.count ?? 0,
      })

      setTodayUsage(todayUsageResult.count ?? 0)

      setLoading(false)
    }

    load()
  }, [router])

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const interval = window.setInterval(async () => {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)

      const [recentActivityResult, todayUsageResult] = await Promise.all([
        supabase
          .from('scans')
          .select('id, scan_type, target_value, risk_level, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', startOfToday.toISOString()),
      ])

      if (!recentActivityResult.error) {
        setActivityFeed((recentActivityResult.data as Scan[]) ?? [])
      }
      if (!todayUsageResult.error) {
        setTodayUsage(todayUsageResult.count ?? 0)
      }
    }, 20000)

    return () => window.clearInterval(interval)
  }, [user])

  useEffect(() => {
    if (!user) return
    if (loading || hasShownAuthToast.current) return

    const authState = searchParams.get('auth')
    if (authState !== 'success') return

    localStorage.setItem('showWelcomePopup', 'true')

    if (isFirstLogin) {
      toast.success('Welcome to SentinelScan ðŸš€')
    } else {
      toast.success('Signed in successfully ðŸŽ‰')
    }

    hasShownAuthToast.current = true

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('auth')
    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `/dashboard?${nextQuery}` : '/dashboard')
  }, [isFirstLogin, loading, router, searchParams, user])

  useEffect(() => {
    if (loading || !user) return

    const shouldShowFromLogin = localStorage.getItem('showWelcomePopup') === 'true'
    const shouldShowForZeroScans = stats.totalScans === 0

    if (shouldShowFromLogin || shouldShowForZeroScans) {
      setShowWelcomePopup(true)
    }

    localStorage.removeItem('showWelcomePopup')
  }, [loading, stats.totalScans, user])

  const getThreatBadge = (level?: string) => {
    switch (level) {
      case 'dangerous':
        return 'bg-red-500/20 text-red-400 border border-red-500/30'
      case 'suspicious':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
      case 'safe':
        return 'bg-green-500/20 text-green-400 border border-green-500/30'
      default:
        return 'bg-neutral-800/50 text-neutral-400 border border-neutral-700'
    }
  }

  const getScanTypeIcon = (type: ScanType) => {
    if (type === 'url') return <Link2 className="h-3.5 w-3.5 text-cyan-300" />
    if (type === 'screenshot') return <ImageIcon className="h-3.5 w-3.5 text-violet-300" />
    return <FileText className="h-3.5 w-3.5 text-blue-300" />
  }

  const getRiskIcon = (level: RiskLevel) => {
    if (level === 'safe') return <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
    if (level === 'suspicious') return <ShieldQuestion className="h-3.5 w-3.5 text-yellow-400" />
    return <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
  }

  return (
    <AuthGuard loadingText="Checking your dashboard access...">
      {loading ? (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <Toaster theme="dark" position="top-right" richColors />
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-2 border-neutral-800 border-t-white animate-spin mx-auto" />
            <p className="text-neutral-400">Loading dashboard...</p>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <Toaster theme="dark" position="top-right" richColors />
          <WelcomePopup isOpen={showWelcomePopup} onClose={() => setShowWelcomePopup(false)} />

      <div className="space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold">
            {!user
              ? 'Welcome to SentinelScan'
              : isFirstLogin
              ? `Welcome to SentinelScan, ${userName}`
              : `Welcome back, ${userName}`}
          </h1>
          <p className="text-neutral-400">
            {!user
              ? 'Monitor scans with a cybersecurity analytics workflow.'
              : 'Monitor scans, detect threats, and review your security posture.'}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-neutral-200">Daily Scan Usage</p>
            <p className="text-sm text-neutral-400">
              {todayUsage} / {dailyQuota} scans used today
            </p>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className={`h-full ${usageBarColor} transition-all duration-700 ease-out`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Plan: {planTier === 'pro' ? 'Pro' : 'Free'} tier
          </p>
        </div>

        {!user ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <h2 className="text-2xl font-semibold">Sign in to view your analytics center</h2>
            <p className="mt-3 text-neutral-400">
              Your personal activity feed, score trends, and scan analytics are available after authentication.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/login"
                className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-md border border-neutral-700 px-5 py-2.5 text-sm transition hover:border-neutral-500"
              >
                Create Account
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <CounterCard label="Total Scans" value={stats.totalScans} />
              <CounterCard label="URL Scans" value={stats.urlScans} />
              <CounterCard label="File Scans" value={stats.fileScans} />
              <CounterCard label="Screenshot Scans" value={stats.screenshotScans} />
              <CounterCard
                label="Threats Detected"
                value={stats.threatsDetected}
                hint="Suspicious + Dangerous"
              />
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              <h2 className="text-xl font-semibold">Security Score Trend (15 Days)</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Daily average safety score based on scan verdicts.
              </p>
              <div className="mt-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid stroke="#262626" strokeDasharray="4 4" />
                    <XAxis dataKey="dateLabel" tick={{ fill: '#a3a3a3', fontSize: 12 }} />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#a3a3a3', fontSize: 12 }}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #262626',
                        borderRadius: '0.75rem',
                        color: '#f5f5f5',
                      }}
                      formatter={(value) => [
                        typeof value === 'number'
                          ? `${value.toFixed(1)} score`
                          : 'No scans',
                        'Security',
                      ]}
                      labelFormatter={(_label, payload) => {
                        const item = payload?.[0]?.payload as TrendPoint | undefined
                        if (!item) return ''
                        return new Date(item.dateKey).toLocaleDateString()
                      }}
                    />
                      <Line
                        type="monotone"
                        dataKey="score"
                      stroke="#22d3ee"
                      strokeWidth={3}
                      dot={{ r: 2, stroke: '#22d3ee', fill: '#22d3ee' }}
                      connectNulls={false}
                      isAnimationActive
                      animationDuration={900}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Recent Scans (Last 15 Days)</h2>
                <Link
                  href="/scan-history"
                  className="text-sm text-cyan-300 hover:text-cyan-200 transition"
                >
                  View full history {'->'}
                </Link>
              </div>

              {scans15Days.length === 0 ? (
                <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-8 text-center">
                  <p className="text-neutral-400">No scans yet</p>
                  <div className="mt-4 flex justify-center gap-3">
                    <Link
                      href="/scan-url"
                      className="rounded bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200"
                    >
                      Scan URL
                    </Link>
                    <Link
                      href="/file-scanner"
                      className="rounded border border-neutral-700 px-4 py-2 text-sm transition hover:border-neutral-500"
                    >
                      Scan File
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-800">
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Type</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Target</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Result</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scans15Days.slice(0, 10).map((scan) => (
                        <tr
                          key={scan.id}
                          className="border-b border-neutral-800 transition hover:bg-neutral-900/50"
                        >
                          <td className="px-4 py-3">
                            <span className="inline-block rounded bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">
                              {scan.scan_type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-xs truncate text-sm text-white">{scan.target_value}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded px-3 py-1 text-xs font-medium ${getThreatBadge(
                                scan.risk_level,
                              )}`}
                            >
                              {scan.risk_level.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-400">
                            {new Date(scan.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] lg:sticky lg:top-24">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Live Activity</h3>
                <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400">
                  refresh 20s
                </span>
              </div>
              {activityFeed.length === 0 ? (
                <p className="text-sm text-neutral-500">No recent activity.</p>
              ) : (
                <ul className="space-y-3">
                  {activityFeed.map((event) => (
                    <li
                      key={event.id}
                      className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 transition hover:border-neutral-700"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-cyan-300">
                          {getScanTypeIcon(event.scan_type)}
                          {event.scan_type}
                        </span>
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${getThreatBadge(
                            event.risk_level,
                          )}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {getRiskIcon(event.risk_level)}
                            {event.risk_level}
                          </span>
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-neutral-200">{event.target_value}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {new Date(event.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
        )}
      </div>
        </div>
      )}
    </AuthGuard>
  )
}

