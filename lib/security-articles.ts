import 'server-only'

import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SecurityArticle, SecurityArticleListResult } from '@/lib/security-articles-shared'

const PAGE_SIZE = 9

export interface SecurityArticleQuery {
  search?: string
  source?: string
  sort?: 'newest'
  page?: number
}

function normalizeArticle(row: Partial<SecurityArticle>): SecurityArticle {
  return {
    id: row.id ?? '',
    title: row.title ?? '',
    description: row.description ?? '',
    content: row.content ?? null,
    link: row.link ?? '',
    source: row.source ?? 'Unknown',
    source_url: row.source_url ?? '',
    cover_image: row.cover_image ?? null,
    published_at: row.published_at ?? new Date().toISOString(),
    created_at: row.created_at ?? new Date().toISOString(),
    views: Number(row.views ?? 0),
    is_new: Boolean(row.is_new),
  }
}

export async function getSecurityArticles(
  query: SecurityArticleQuery
): Promise<SecurityArticleListResult> {
  const page = Math.max(1, query.page ?? 1)
  const source = (query.source ?? '').trim()
  const search = (query.search ?? '').trim()
  return getSecurityArticlesCached(page, source, search)
}

const getSecurityArticlesCached = unstable_cache(
  async (page: number, source: string, search: string): Promise<SecurityArticleListResult> => {
    const supabase = createAdminClient()
    let dbQuery = supabase
    .from('security_articles')
    .select('*', { count: 'exact' })
    .order('published_at', { ascending: false })

    if (source) {
      dbQuery = dbQuery.eq('source', source)
    }

    if (search) {
      dbQuery = dbQuery.ilike('title', `%${search}%`)
    }

    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error, count } = await dbQuery.range(from, to)

    if (error) {
      console.error('[security-articles] list query failed:', error)
      return {
        articles: [],
        total: 0,
        page: 1,
        pageSize: PAGE_SIZE,
        totalPages: 0,
      }
    }

    const total = count ?? 0
    return {
      articles: ((data ?? []) as Partial<SecurityArticle>[]).map(normalizeArticle),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE) || 1,
    }
  },
  ['security-articles-list'],
  { revalidate: 600 }
)

export async function getSecurityArticleById(id: string): Promise<SecurityArticle | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('security_articles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return normalizeArticle(data as Partial<SecurityArticle>)
}

export async function incrementSecurityArticleViews(id: string): Promise<number | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('security_articles')
    .select('id, views')
    .eq('id', id)
    .single()

  if (error || !data) {
    console.error('[security-articles] failed to read views:', error)
    return null
  }

  const nextViews = Number(data.views ?? 0) + 1
  const { error: updateError } = await supabase
    .from('security_articles')
    .update({ views: nextViews })
    .eq('id', id)

  if (updateError) {
    console.error('[security-articles] failed to update views:', updateError)
    return null
  }

  return nextViews
}

export async function getSecurityArticleSources(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('security_articles')
    .select('source')
    .order('source', { ascending: true })

  if (error || !data) {
    return []
  }

  return Array.from(new Set(data.map((row) => row.source).filter(Boolean)))
}

export async function getRelatedSecurityArticles(
  currentId: string,
  source: string
): Promise<SecurityArticle[]> {
  const supabase = await createClient()

  const { data: sameSource } = await supabase
    .from('security_articles')
    .select('*')
    .eq('source', source)
    .neq('id', currentId)
    .order('published_at', { ascending: false })
    .limit(3)

  if (sameSource && sameSource.length >= 3) {
    return (sameSource as Partial<SecurityArticle>[]).map(normalizeArticle)
  }

  const { data: others } = await supabase
    .from('security_articles')
    .select('*')
    .neq('id', currentId)
    .order('published_at', { ascending: false })
    .limit(3)

  return (others ?? [] as any[]).map((row) => normalizeArticle(row as Partial<SecurityArticle>))
}
