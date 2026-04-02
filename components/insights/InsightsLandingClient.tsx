'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { SecurityArticle } from '@/lib/security-articles-shared'
import { deriveCategory, estimateReadingTime } from '@/lib/security-articles-shared'

interface InsightsLandingClientProps {
  featuredArticle: SecurityArticle | null
  articles: SecurityArticle[]
  page: number
  totalPages: number
  nextUpdate: string
  previewLocked?: boolean
}

function formatArticleDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function InsightsLandingClient({
  featuredArticle,
  articles,
  page,
  totalPages,
  nextUpdate,
  previewLocked = false,
}: InsightsLandingClientProps) {
  const router = useRouter()
  const pathname = usePathname()

  const breaking = useMemo(() => {
    if (!featuredArticle) return false
    const published = new Date(featuredArticle.published_at).getTime()
    return Date.now() - published <= 24 * 60 * 60 * 1000
  }, [featuredArticle])

  const goToPage = (nextPage: number) => {
    router.push(`${pathname}?page=${nextPage}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-12"
    >
      <section className="space-y-3">
        <h1 className="text-4xl font-bold">Security Insights</h1>
        <p className="text-gray-400">
          Premium cybersecurity intelligence feed powered by live threat reporting and trusted sources.
        </p>
        <p className="text-cyan-400 text-sm font-medium" title={`Computed schedule: ${nextUpdate}`}>
          Next Articles Update: Sunday, 04:00 UTC
        </p>
      </section>

      <div className="relative">
        <div
          className={previewLocked ? 'blur-sm pointer-events-none select-none transition duration-300' : 'transition duration-300'}
        >
          {featuredArticle && (
            <section className="mt-10 mb-12">
              <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.25 }}>
                <Link
                  href={`/insights/${featuredArticle.id}`}
                  className="group relative block rounded-2xl overflow-hidden border border-white/10 bg-slate-950 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-[0_20px_40px_-28px_rgba(8,145,178,0.85)]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.14),_transparent_50%),linear-gradient(145deg,#020617_0%,#0f172a_48%,#020617_100%)]" />
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.06)_1px,transparent_1px)] bg-[size:28px_28px] opacity-25" />
                  <div className="relative p-6 md:p-10 space-y-6">
                    <div className="max-w-4xl space-y-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 w-fit px-2.5 py-1 rounded-md text-xs bg-cyan-500/15 text-cyan-200 border border-cyan-400/20">
                          {breaking ? 'Breaking' : 'Featured'}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-slate-900/80 text-slate-200 border border-slate-700/60">
                          {featuredArticle.source}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-slate-900/80 text-slate-300 border border-slate-700/60">
                          {deriveCategory(
                            featuredArticle.title,
                            featuredArticle.description,
                            featuredArticle.source
                          )}
                        </span>
                      </div>
                      <h2 className="text-3xl md:text-5xl font-bold leading-tight text-slate-50">
                        {featuredArticle.title}
                      </h2>
                      <p className="text-slate-300 text-base md:text-lg max-w-3xl line-clamp-3">
                        {featuredArticle.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
                        <span>{formatArticleDate(featuredArticle.published_at)}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-500" />
                        <span>{estimateReadingTime(featuredArticle.description || featuredArticle.title)}</span>
                      </div>
                      <span className="inline-flex w-fit px-5 py-2.5 rounded-lg bg-cyan-300 text-slate-950 text-sm font-semibold transition-colors duration-300 group-hover:bg-cyan-200">
                        Read Full Report
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            </section>
          )}

          <section>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {articles.map((article, idx) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                  whileHover={{ y: -4 }}
                  className="group h-full rounded-2xl border border-white/10 bg-slate-950/80 overflow-hidden transition-all duration-300 hover:border-cyan-500/40 hover:shadow-[0_20px_40px_-28px_rgba(8,145,178,0.85)]"
                >
                  <Link href={`/insights/${article.id}`} className="block h-full">
                    <div className="p-6 h-full flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-block px-2.5 py-1 rounded-md text-xs bg-slate-900 text-slate-200 border border-slate-700/70">
                            {article.source}
                          </span>
                          <span className="inline-block px-2.5 py-1 rounded-md text-xs bg-cyan-500/15 text-cyan-200 border border-cyan-400/20">
                            {deriveCategory(article.title, article.description, article.source)}
                          </span>
                          {article.is_new && (
                            <span className="inline-block px-2.5 py-1 rounded-md text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-400/25">
                              New
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-semibold leading-snug text-slate-50 line-clamp-3">
                          {article.title}
                        </h3>
                        <p className="text-sm text-slate-400 line-clamp-3">{article.description}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 pt-4">
                        <span>{formatArticleDate(article.published_at)}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-600" />
                        <span>{estimateReadingTime(article.description || article.title)}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="px-4 py-2 rounded border border-neutral-700 hover:border-neutral-500 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <p className="text-sm text-neutral-400">
              Page {page} of {Math.max(totalPages, 1)}
            </p>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="px-4 py-2 rounded border border-neutral-700 hover:border-neutral-500 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>

        {previewLocked ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-gradient-to-b from-black/35 via-black/65 to-black/80 p-4 sm:p-6">
            <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950/90 p-6 text-center shadow-2xl">
              <h3 className="text-xl font-semibold text-white">
                Login or Sign Up to Unlock Full Security Insights
              </h3>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth?mode=login"
                  className="w-full rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/auth?mode=signup"
                  className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
                >
                  Sign Up
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}

