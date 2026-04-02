import 'server-only'

import Parser from 'rss-parser'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIngestionCoverImage } from '@/lib/security-category-images'
import { withTimeout } from '@/lib/timeout'

type RssItem = {
  title?: string
  contentSnippet?: string
  content?: string
  link?: string
  isoDate?: string
  pubDate?: string
  enclosure?: { url?: string }
}

const SOURCES = [
  {
    name: 'The Hacker News',
    sourceUrl: 'https://thehackernews.com',
    feedUrl: 'https://feeds.feedburner.com/TheHackersNews',
  },
  {
    name: 'BleepingComputer',
    sourceUrl: 'https://www.bleepingcomputer.com',
    feedUrl: 'https://www.bleepingcomputer.com/feed/',
  },
  {
    name: 'Krebs on Security',
    sourceUrl: 'https://krebsonsecurity.com',
    feedUrl: 'https://krebsonsecurity.com/feed/',
  },
] as const

function extractFirstImage(item: RssItem): string | null {
  if (item.enclosure?.url) {
    return item.enclosure.url
  }

  const blob = `${item.content ?? ''} ${item.contentSnippet ?? ''}`
  const match = blob.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match?.[1] ?? null
}

function normalizeDate(item: RssItem): string {
  const raw = item.isoDate ?? item.pubDate
  if (!raw) return new Date().toISOString()
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

function isNewArticle(publishedAt: string): boolean {
  const published = new Date(publishedAt).getTime()
  const now = Date.now()
  return now - published <= 48 * 60 * 60 * 1000
}

export async function ingestSecurityArticles() {
  const parser = new Parser()
  const supabase = createAdminClient()

  const preparedRows: Array<Record<string, any>> = []

  const feedResults = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const feed = await withTimeout(
        () => parser.parseURL(source.feedUrl),
        15_000,
        `rss fetch ${source.name}`
      )

      return ((feed.items ?? []) as RssItem[])
        .map((item) => {
          const link = item.link?.trim()
          const title = item.title?.trim()
          if (!link || !title) return null

          const published_at = normalizeDate(item)
          const description = (item.contentSnippet ?? '').trim()
          return {
            title,
            description,
            content: (item.content ?? null) as string | null,
            link,
            source: source.name,
            source_url: source.sourceUrl,
            cover_image: getIngestionCoverImage({
              title,
              description,
              source: source.name,
              extractedImageUrl: extractFirstImage(item),
            }),
            published_at,
            is_new: isNewArticle(published_at),
          }
        })
        .filter(Boolean) as Array<Record<string, any>>
    })
  )

  for (const result of feedResults) {
    if (result.status === 'fulfilled') {
      preparedRows.push(...result.value)
    } else {
      console.error('[rss] failed to parse feed:', result.reason)
    }
  }

  if (preparedRows.length === 0) {
    return { inserted: 0, updatedNewFlags: 0 }
  }

  const { error: insertError } = await supabase
    .from('security_articles')
    .upsert(preparedRows, { onConflict: 'link', ignoreDuplicates: true })

  if (insertError) {
    console.error('[rss] failed to upsert security articles:', insertError)
    throw insertError
  }

  const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { error: updateOldError } = await supabase
    .from('security_articles')
    .update({ is_new: false })
    .lt('published_at', staleThreshold)

  if (updateOldError) {
    console.error('[rss] failed to update stale is_new flags:', updateOldError)
  }

  const { error: updateNewError } = await supabase
    .from('security_articles')
    .update({ is_new: true })
    .gte('published_at', staleThreshold)

  if (updateNewError) {
    console.error('[rss] failed to update fresh is_new flags:', updateNewError)
  }

  return {
    inserted: preparedRows.length,
    updatedNewFlags: 1,
  }
}
