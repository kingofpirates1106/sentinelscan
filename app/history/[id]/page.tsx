import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth?mode=login')
  }

  const { data: scan, error } = await supabase
    .from('scans')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !scan) {
    notFound()
  }

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

  const stats = scan.stats as Record<string, number> | null
  const screenshotReport =
    (scan.result as Record<string, unknown> | null) ??
    ((scan.raw_response as Record<string, unknown> | null)?.result as Record<string, unknown> | null)
  const screenshotSafetyScore =
    typeof scan.safety_score === 'number'
      ? scan.safety_score
      : typeof stats?.safety_score === 'number'
        ? stats.safety_score
        : typeof (scan.raw_response as Record<string, unknown> | null)?.safety_score === 'number'
          ? ((scan.raw_response as Record<string, unknown>).safety_score as number)
          : null

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="space-y-6">
        <Link
          href="/scan-history"
          className="text-sm text-cyan-300 hover:text-cyan-200 transition"
        >
          â† Back to Scan History
        </Link>

        <h1 className="text-2xl font-bold">Scan Details</h1>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
          <div>
            <p className="text-sm text-neutral-400 mb-1">Target</p>
            <p className="text-white break-all font-mono text-sm">
              {scan.target_value}
            </p>
          </div>
          <div>
            <p className="text-sm text-neutral-400 mb-1">Type</p>
            <span className="inline-block px-3 py-1 rounded text-xs font-medium bg-neutral-800 text-neutral-300">
              {scan.scan_type?.toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm text-neutral-400 mb-1">Risk Level</p>
            <span
              className={`inline-block px-3 py-1 rounded text-xs font-medium ${getThreatBadge(
                scan.risk_level
              )}`}
            >
              {scan.risk_level?.toUpperCase() ?? 'â€”'}
            </span>
          </div>
          <div>
            <p className="text-sm text-neutral-400 mb-1">Date</p>
            <p className="text-white text-sm">
              {new Date(scan.created_at).toLocaleString()}
            </p>
          </div>
          {stats && (
            <div className="pt-4 border-t border-neutral-800">
              <p className="text-sm text-neutral-400 mb-2">Result summary</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-neutral-400">Harmless</span>
                  <span className="ml-2 font-medium text-green-500">
                    {stats.harmless ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400">Malicious</span>
                  <span className="ml-2 font-medium text-red-500">
                    {stats.malicious ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400">Suspicious</span>
                  <span className="ml-2 font-medium text-yellow-500">
                    {stats.suspicious ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400">Undetected</span>
                  <span className="ml-2 font-medium text-neutral-400">
                    {stats.undetected ?? 0}
                  </span>
                </div>
              </div>
            </div>
          )}
          {scan.scan_type === 'screenshot' && screenshotReport && (
            <div className="pt-4 border-t border-neutral-800 space-y-3">
              <p className="text-sm text-neutral-400">Screenshot analysis report</p>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Threat Summary</p>
                <p className="text-sm text-neutral-200">
                  {String(screenshotReport.threatSummary ?? 'No summary provided')}
                </p>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Detected Indicators</p>
                <ul className="mt-2 space-y-1 text-sm text-neutral-200">
                  {Array.isArray(screenshotReport.detectedIndicators) &&
                  screenshotReport.detectedIndicators.length > 0 ? (
                    screenshotReport.detectedIndicators.map((item, idx) => (
                      <li key={`${String(item)}-${idx}`}>â€¢ {String(item)}</li>
                    ))
                  ) : (
                    <li>â€¢ No indicators captured.</li>
                  )}
                </ul>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Recommended Action</p>
                <p className="text-sm text-neutral-200">
                  {String(screenshotReport.recommendedAction ?? 'Verify sender and domain before proceeding.')}
                </p>
                {screenshotSafetyScore != null ? (
                  <p className="text-xs text-neutral-400">Safety Score: {screenshotSafetyScore}/100</p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

