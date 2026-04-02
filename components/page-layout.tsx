import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { MainNav } from './main-nav'
import { Footer } from './footer'

export async function PageLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <MainNav user={user} />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  )
}
