import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { MainNav } from '@/components/main-nav'
import { Footer } from '@/components/footer'

export default async function Layout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <MainNav user={user} />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  )
}
