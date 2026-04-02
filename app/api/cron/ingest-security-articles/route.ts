import Parser from 'rss-parser'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIngestionCoverImage, isValidCoverImageUrl } from '@/lib/security-category-images'
import { withTimeout } from '@/lib/timeout'

export const runtime = 'nodejs'

type RssItem = {
  title?: string
  contentSnippet?: string
  content?: string
  link?: string
  isoDate?: string
  pubDate?: string
  enclosure?: { url?: string }
}

const FORCE_UPDATE_EXISTING_COVER_IMAGES = true

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

function extractImage(item: any): string | null {
  // 1. media:content
  if (item?.['media:content']?.[0]?.$?.url) {
    return item['media:content'][0].$.url
  }

  // 2. enclosure
  if (item?.enclosure?.url) {
    return item.enclosure.url
  }

  // 3. image inside content HTML
  const html = item.content || item['content:encoded'] || ''
  const match = html.match(/<img[^>]+src="([^">]+)"/i)
  if (match && match[1]) {
    return match[1]
  }

  return null
}

function normalizeDate(item: RssItem): string {
  const raw = item.isoDate ?? item.pubDate
  if (!raw) return new Date().toISOString()
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

function isNewArticle(publishedAt: string): boolean {
  return Date.now() - new Date(publishedAt).getTime() <= 48 * 60 * 60 * 1000
}

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    console.error('[cron-ingest] Missing CRON_SECRET')
    return NextResponse.json(
      { success: false, error: 'CRON_SECRET is not configured' },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${expectedSecret}`) {
    console.error('[cron-ingest] Invalid Authorization header')
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const parser = new Parser()
  const parsedRows: Array<Record<string, any>> = []
  let feedsFetched = 0
  let articlesParsed = 0

  try {
    const feedResults = await Promise.allSettled(
      SOURCES.map(async (source) => {
        const feed = await withTimeout(
          () => parser.parseURL(source.feedUrl),
          15_000,
          `rss fetch ${source.name}`
        )

        const rows = ((feed.items ?? []) as RssItem[])
          .map((item) => {
            const title = item.title?.trim()
            const link = item.link?.trim()
            if (!title || !link) return null

            const published_at = normalizeDate(item)
            const description = (item.contentSnippet ?? '').trim()
            const imageUrl = extractImage(item)

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
                extractedImageUrl: imageUrl,
              }),
              published_at,
              is_new: isNewArticle(published_at),
            }
          })
          .filter(Boolean) as Array<Record<string, any>>

        return { source: source.name, rows }
      })
    )

    for (const result of feedResults) {
      if (result.status === 'fulfilled') {
        feedsFetched += 1
        parsedRows.push(...result.value.rows)
        articlesParsed += result.value.rows.length
      } else {
        console.error('[cron-ingest] RSS parsing failed:', result.reason)
      }
    }

    if (feedsFetched === 0) {
      return NextResponse.json(
        { success: false, error: 'RSS parsing failed for all sources' },
        { status: 502 }
      )
    }

    const uniqueRows = new Map<string, Record<string, any>>()
    let duplicateInFeed = 0
    for (const row of parsedRows) {
      if (uniqueRows.has(row.link)) {
        duplicateInFeed += 1
        continue
      }
      uniqueRows.set(row.link, row)
    }

    const rows = Array.from(uniqueRows.values())
    const links = rows.map((row) => row.link)

    const supabase = createAdminClient()
    let existingCount = 0

    if (links.length > 0) {
      const { data: existingRows, error: existingError } = await supabase
        .from('security_articles')
        .select('link')
        .in('link', links)

      if (existingError) {
        console.error('[cron-ingest] Failed checking existing links:', existingError)
        return NextResponse.json(
          { success: false, error: 'Failed to check duplicates' },
          { status: 500 }
        )
      }

      existingCount = existingRows?.length ?? 0
      const existingSet = new Set((existingRows ?? []).map((r) => r.link))
      const newRows = rows.filter((row) => !existingSet.has(row.link))
      const existingRowsToUpdate = rows
        .filter((row) => existingSet.has(row.link))
        .map((row) => ({
          link: row.link,
          cover_image: row.cover_image,
        }))

      if (newRows.length > 0) {
        const { error: insertError } = await supabase
          .from('security_articles')
          .insert(newRows)

        if (insertError) {
          console.error('[cron-ingest] Supabase insert failed:', insertError)
          return NextResponse.json(
            { success: false, error: 'Failed to insert new articles' },
            { status: 500 }
          )
        }
      }

      if (
        FORCE_UPDATE_EXISTING_COVER_IMAGES &&
        existingRowsToUpdate.length > 0
      ) {
        for (const row of existingRowsToUpdate) {
          const { error: updateCoverImageError } = await supabase
            .from('security_articles')
            .update({ cover_image: row.cover_image })
            .eq('link', row.link)

          if (updateCoverImageError) {
            console.error(
              '[cron-ingest] Failed to update existing cover images:',
              updateCoverImageError
            )
            return NextResponse.json(
              { success: false, error: 'Failed to update existing cover images' },
              { status: 500 }
            )
          }
        }
      }

      if (FORCE_UPDATE_EXISTING_COVER_IMAGES) {
        const generalFallback = '/images/category/general-security.svg'
        const { error: nullCoverImageError } = await supabase
          .from('security_articles')
          .update({ cover_image: generalFallback })
          .is('cover_image', null)

        if (nullCoverImageError) {
          console.error(
            '[cron-ingest] Failed to backfill null cover images:',
            nullCoverImageError
          )
          return NextResponse.json(
            { success: false, error: 'Failed to backfill null cover images' },
            { status: 500 }
          )
        }

        const { error: emptyCoverImageError } = await supabase
          .from('security_articles')
          .update({ cover_image: generalFallback })
          .eq('cover_image', '')

        if (emptyCoverImageError) {
          console.error(
            '[cron-ingest] Failed to backfill empty cover images:',
            emptyCoverImageError
          )
          return NextResponse.json(
            { success: false, error: 'Failed to backfill empty cover images' },
            { status: 500 }
          )
        }

        const { data: existingCoverRows, error: coverRowsError } = await supabase
          .from('security_articles')
          .select('id, title, description, source, cover_image')

        if (coverRowsError) {
          console.error(
            '[cron-ingest] Failed to fetch existing cover images for validation:',
            coverRowsError
          )
          return NextResponse.json(
            { success: false, error: 'Failed validating existing cover images' },
            { status: 500 }
          )
        }

        const invalidCoverRows = (existingCoverRows ?? []).filter(
          (row) => !isValidCoverImageUrl(row.cover_image)
        )

        for (const row of invalidCoverRows) {
          const nextCoverImage = getIngestionCoverImage({
            title: row.title ?? '',
            description: row.description ?? '',
            source: row.source ?? '',
            extractedImageUrl: row.cover_image,
          })

          const { error: invalidCoverUpdateError } = await supabase
            .from('security_articles')
            .update({ cover_image: nextCoverImage })
            .eq('id', row.id)

          if (invalidCoverUpdateError) {
            console.error(
              '[cron-ingest] Failed to repair invalid existing cover image:',
              invalidCoverUpdateError
            )
            return NextResponse.json(
              { success: false, error: 'Failed to repair invalid existing cover images' },
              { status: 500 }
            )
          }
        }
      }

      const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { error: staleError } = await supabase
        .from('security_articles')
        .update({ is_new: false })
        .lt('published_at', staleThreshold)
      if (staleError) {
        console.error('[cron-ingest] Failed to refresh old is_new flags:', staleError)
      }

      const { error: freshError } = await supabase
        .from('security_articles')
        .update({ is_new: true })
        .gte('published_at', staleThreshold)
      if (freshError) {
        console.error('[cron-ingest] Failed to refresh new is_new flags:', freshError)
      }

      const inserted = newRows.length
      const skipped = existingCount + duplicateInFeed

      console.log('[cron-ingest] feeds fetched:', feedsFetched)
      console.log('[cron-ingest] articles parsed:', articlesParsed)
      console.log('[cron-ingest] inserted:', inserted)
      console.log('[cron-ingest] skipped:', skipped)

      return NextResponse.json({
        success: true,
        feedsFetched,
        articlesParsed,
        inserted,
        skipped,
      })
    }

    console.log('[cron-ingest] feeds fetched:', feedsFetched)
    console.log('[cron-ingest] articles parsed:', articlesParsed)
    console.log('[cron-ingest] inserted:', 0)
    console.log('[cron-ingest] skipped:', duplicateInFeed)

    return NextResponse.json({
      success: true,
      feedsFetched,
      articlesParsed,
      inserted: 0,
      skipped: duplicateInFeed,
    })
  } catch (error) {
    console.error('[cron-ingest] Unexpected ingestion failure:', error)
    return NextResponse.json(
      { success: false, error: 'Unexpected ingestion failure' },
      { status: 500 }
    )
  }
}
