'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

interface Scan {
  id: string
  scan_type: string
  target_value: string
  risk_level: string
  created_at: string
}

interface HistoryClientProps {
  initialScans: Scan[]
  initialTotal: number
  initialPage: number
  initialTotalPages: number
  initialFilter: string
}

export function HistoryClient({
  initialScans,
  initialTotal,
  initialPage,
  initialTotalPages,
  initialFilter,
}: HistoryClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setFilter = (filter: string) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set('filter', filter)
    next.delete('page')
    router.push(`/scan-history?${next.toString()}`)
  }

  const setPage = (page: number) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set('page', String(page))
    router.push(`/scan-history?${next.toString()}`)
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

  const filters = [
    { value: 'all', label: 'All' },
    { value: 'url', label: 'URL' },
    { value: 'file', label: 'File' },
    { value: 'screenshot', label: 'Screenshot' },
  ] as const

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-neutral-400">Type:</span>
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${
              initialFilter === f.value
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-neutral-400">
        {initialTotal} scan{initialTotal !== 1 ? 's' : ''} total
      </p>

      {initialScans.length === 0 ? (
        <div className="p-8 rounded-lg border border-neutral-800 bg-neutral-900/50 text-center">
          <p className="text-neutral-400">No scans found</p>
          <Link
            href="/scan-url"
            className="inline-block mt-3 text-cyan-300 hover:text-cyan-200 text-sm"
          >
            Scan a URL or file
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/50">
                  <th className="text-left py-3 px-4 font-medium text-neutral-400 text-sm">
                    Target
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-400 text-sm">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-400 text-sm">
                    Risk Level
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-400 text-sm">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-400 text-sm w-28">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {initialScans.map((scan) => (
                  <tr
                    key={scan.id}
                    className="border-b border-neutral-800 hover:bg-neutral-900/50 transition"
                  >
                    <td className="py-3 px-4">
                      <p className="text-sm text-white truncate max-w-xs">
                        {scan.target_value}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-3 py-1 rounded text-xs font-medium bg-neutral-800 text-neutral-300">
                        {scan.scan_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-3 py-1 rounded text-xs font-medium ${getThreatBadge(
                          scan.risk_level
                        )}`}
                      >
                        {scan.risk_level?.toUpperCase() ?? 'â€”'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-400">
                      {new Date(scan.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/scan-history/${scan.id}`}
                        className="text-sm text-cyan-300 hover:text-cyan-200 transition"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {initialTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-neutral-400">
                Page {initialPage} of {initialTotalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(initialPage - 1)}
                  disabled={initialPage <= 1}
                  className="px-3 py-1.5 rounded border border-neutral-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:border-neutral-500"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(initialPage + 1)}
                  disabled={initialPage >= initialTotalPages}
                  className="px-3 py-1.5 rounded border border-neutral-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:border-neutral-500"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

