'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
  loadingText?: string
}

export function AuthGuard({
  children,
  redirectTo = '/auth?mode=login',
  loadingText = 'Checking session...',
}: AuthGuardProps) {
  const [isChecking, setIsChecking] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    const checkSession = async () => {
      const supabase = createClient()
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!isMounted) return

      setSession(currentSession)
      setIsChecking(false)

      if (!currentSession) {
        router.replace(redirectTo)
      }
    }

    checkSession()

    return () => {
      isMounted = false
    }
  }, [redirectTo, router])

  if (isChecking || !session) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-neutral-800 border-t-white animate-spin mx-auto" />
          <p className="text-neutral-400">{loadingText}</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

