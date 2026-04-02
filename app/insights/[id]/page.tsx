import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArticleClient } from '@/components/ArticleClient'
import {
  getRelatedSecurityArticles,
  getSecurityArticleById,
  incrementSecurityArticleViews,
} from '@/lib/security-articles'

export default async function SecurityArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { id } = await params
  const article = await getSecurityArticleById(id)
  if (!article) {
    notFound()
  }

  const nextViews = await incrementSecurityArticleViews(article.id)
  const related = await getRelatedSecurityArticles(article.id, article.source)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <ArticleClient article={{ ...article, views: nextViews ?? article.views }} related={related} />
    </div>
  )
}
