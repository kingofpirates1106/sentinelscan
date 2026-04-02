import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/server'
import { getSecurityArticles } from '@/lib/security-articles'

const InsightsLandingClient = dynamic(
  () => import('@/components/insights/InsightsLandingClient').then((mod) => mod.InsightsLandingClient),
  {
    loading: () => (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-neutral-800 rounded" />
        <div className="h-4 w-[420px] bg-neutral-900 rounded" />
        <div className="h-[320px] rounded-2xl border border-neutral-800 bg-neutral-900/50" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="h-72 rounded-2xl border border-neutral-800 bg-neutral-900/50" />
          <div className="h-72 rounded-2xl border border-neutral-800 bg-neutral-900/50" />
          <div className="h-72 rounded-2xl border border-neutral-800 bg-neutral-900/50" />
        </div>
      </div>
    ),
  }
)

function getNextUpdateDate(now: Date = new Date()) {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0, 0)
  )
  const daysUntilSunday = (7 - next.getUTCDay()) % 7
  next.setUTCDate(next.getUTCDate() + daysUntilSunday)

  if (now.getTime() >= next.getTime()) {
    next.setUTCDate(next.getUTCDate() + 7)
  }

  return next
}

function formatNextUpdateDate(date: Date) {
  const datePart = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)

  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date)

  return `${datePart} at ${timePart} UTC`
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const supabase = await createClient()
  const [{ data: { session } }, params] = await Promise.all([
    supabase.auth.getSession(),
    searchParams,
  ])

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const articlesResult = await getSecurityArticles({ sort: 'newest', page })
  const featuredArticle = articlesResult.articles[0] ?? null
  const remainingArticles = featuredArticle
    ? articlesResult.articles.filter((a) => a.id !== featuredArticle.id)
    : []
  const nextUpdate = formatNextUpdateDate(getNextUpdateDate())

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
      <Suspense
        fallback={
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-8 text-neutral-400">
            Loading security insights...
          </div>
        }
      >
        <InsightsLandingClient
          featuredArticle={featuredArticle}
          articles={remainingArticles}
          page={articlesResult.page}
          totalPages={articlesResult.totalPages}
          nextUpdate={nextUpdate}
          previewLocked={!session}
        />
      </Suspense>
    </div>
  )
}

