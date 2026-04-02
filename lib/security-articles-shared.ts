export interface SecurityArticle {
  id: string
  title: string
  description: string
  content: string | null
  link: string
  source: string
  source_url: string
  cover_image: string | null
  published_at: string
  created_at: string
  views: number
  is_new: boolean
}

export interface SecurityArticleListResult {
  articles: SecurityArticle[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k views`
  return `${views} views`
}

export function estimateReadingTime(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.ceil(words / 220))
  return `${minutes} min read`
}

export function deriveCategory(title: string, description: string, source: string): string {
  const blob = `${title} ${description} ${source}`.toLowerCase()
  if (blob.includes('phish')) return 'Phishing'
  if (blob.includes('ransom')) return 'Ransomware'
  if (blob.includes('malware') || blob.includes('trojan') || blob.includes('worm')) return 'Malware'
  if (blob.includes('browser') || blob.includes('web')) return 'Web Security'
  if (blob.includes('vulnerability') || blob.includes('cve')) return 'Vulnerability'
  return 'Threat Intel'
}
