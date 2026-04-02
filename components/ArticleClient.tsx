'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import type { SecurityArticle } from '@/lib/security-articles-shared'
import { deriveCategory, estimateReadingTime } from '@/lib/security-articles-shared'

interface ArticleClientProps {
  article: SecurityArticle
  related: SecurityArticle[]
}

interface HeadingItem {
  id: string
  level: 2 | 3
  text: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
}

function extractHeadings(content: string): HeadingItem[] {
  const lines = content.split('\n')
  const headings: HeadingItem[] = []
  for (const line of lines) {
    if (line.startsWith('## ')) {
      const text = line.replace('## ', '').trim()
      headings.push({ id: slugify(text), level: 2, text })
    } else if (line.startsWith('### ')) {
      const text = line.replace('### ', '').trim()
      headings.push({ id: slugify(text), level: 3, text })
    }
  }
  return headings
}

export function ArticleClient({ article, related }: ArticleClientProps) {
  const [progress, setProgress] = useState(0)
  const contentForReading = (article.content || article.description).trim()
  const headings = useMemo(() => extractHeadings(contentForReading), [contentForReading])
  const readingTime = useMemo(() => estimateReadingTime(contentForReading), [contentForReading])
  const readingMinutes = useMemo(() => readingTime.replace(' min read', ''), [readingTime])
  const category = useMemo(
    () => deriveCategory(article.title, article.description, article.source),
    [article]
  )
  const formattedDate = useMemo(
    () =>
      new Date(article.published_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [article.published_at]
  )
  const isTruncatedContent = useMemo(
    () => /\[\]|\bread more\b/i.test(contentForReading),
    [contentForReading]
  )
  const articleHtml = useMemo(() => {
    if (!isTruncatedContent) return contentForReading
    return contentForReading
      .replace(/\[\]/g, '')
      .replace(/read more[\s\S]*$/i, '')
      .trim()
  }, [contentForReading, isTruncatedContent])

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      const total = doc.scrollHeight - doc.clientHeight
      const next = total > 0 ? (window.scrollY / total) * 100 : 0
      setProgress(Math.max(0, Math.min(100, next)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative"
    >
      <motion.div
        className="fixed top-0 left-0 h-[3px] bg-cyan-400 z-50"
        style={{ width: `${progress}%` }}
        transition={{ type: 'tween', duration: 0.2 }}
      />

      <section className="rounded-2xl overflow-hidden border border-neutral-800">
        <div className="relative h-[340px] md:h-[420px]">
          {article.cover_image ? (
            <img
              src={article.cover_image}
              alt={article.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-neutral-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
          <div className="absolute inset-0 p-8 md:p-12 flex flex-col justify-end">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block px-2 py-1 rounded text-xs bg-cyan-500/20 text-cyan-300">
                {category}
              </span>
              <span className="inline-block px-2 py-1 rounded text-xs bg-neutral-900/70 text-neutral-300">
                {article.source}
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-3 max-w-4xl">{article.title}</h1>
            <div className="mt-4 mb-8 flex items-center gap-4 text-sm text-gray-400">
              <span>{readingMinutes} min read</span>
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 mt-10">
        <article className="max-w-3xl">
          <div
            className="prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: articleHtml || article.description }}
          />
          {isTruncatedContent && (
            <div className="mt-6">
              <a
                href={article.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit px-4 py-2 rounded bg-white text-black text-sm font-medium hover:bg-neutral-200 transition"
              >
                Read full article on original site
              </a>
            </div>
          )}
          <div className="mt-8 p-4 rounded-lg border border-neutral-800 bg-neutral-900/40">
            <p className="text-sm text-neutral-400 mb-2">Original Source</p>
            <a
              href={article.link}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 hover:text-cyan-200 transition break-all"
            >
              {article.link}
            </a>
          </div>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-4">
            <Link href="/insights" className="text-sm text-cyan-300 hover:text-cyan-200 transition">
              &lt;- Back to Insights
            </Link>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">On this page</p>
              <div className="space-y-2">
                {headings.length > 0 ? (
                  headings.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      className={`block text-sm hover:text-white transition ${
                        heading.level === 3 ? 'text-neutral-500 pl-3' : 'text-neutral-300'
                      }`}
                    >
                      {heading.text}
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-neutral-500">No headings available.</p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-14 space-y-4">
        <h2 className="text-2xl font-bold">Related Articles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {related.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ y: -4 }}
              className="group rounded-2xl border border-neutral-800 bg-slate-950/80 overflow-hidden transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.35),0_20px_40px_-28px_rgba(8,145,178,0.85)]"
            >
              <Link href={`/insights/${item.id}`} className="block">
                <div className="relative h-16 border-b border-slate-800">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.14),_transparent_55%),linear-gradient(150deg,#020617_0%,#111827_55%,#020617_100%)]" />
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.05)_1px,transparent_1px)] bg-[size:22px_22px] opacity-30" />
                  <div className="absolute right-4 top-3 h-4 w-4 rounded-full border border-cyan-300/35 bg-cyan-300/5" />
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block px-2.5 py-1 rounded-md text-xs bg-slate-900 text-slate-200 border border-slate-700/70">
                      {item.source}
                    </span>
                    <span className="inline-block px-2.5 py-1 rounded-md text-xs bg-cyan-500/15 text-cyan-200 border border-cyan-400/20">
                      {deriveCategory(item.title, item.description, item.source)}
                    </span>
                  </div>
                  <p className="font-semibold leading-snug line-clamp-3">{item.title}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </motion.div>
  )
}
