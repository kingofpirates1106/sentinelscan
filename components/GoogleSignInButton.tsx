'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

type GoogleSignInButtonProps = {
  callbackPath?: string
  nextPath?: string
  className?: string
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.2-3.8 9.2-9.2 0-.6-.1-1.1-.1-1.6H12z"
      />
      <path
        fill="#34A853"
        d="M3.6 7.7l3.2 2.4C7.6 8 9.6 6.5 12 6.5c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 8.3 2.5 5.1 4.6 3.6 7.7z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.5c2.5 0 4.7-.8 6.2-2.3l-3-2.5c-.8.6-1.8.9-3.2.9-2.4 0-4.4-1.6-5.1-3.8l-3.3 2.6c1.5 3.1 4.7 5.1 8.4 5.1z"
      />
      <path
        fill="#4285F4"
        d="M21.2 12.3c0-.6-.1-1.1-.1-1.6H12v3.9h5.5c-.3 1.2-1 2.2-2 2.9l3 2.5c1.8-1.7 2.7-4.2 2.7-7.7z"
      />
    </svg>
  )
}

export default function GoogleSignInButton({
  callbackPath = '/auth/callback',
  nextPath = '/dashboard?auth=success',
  className = '',
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    const supabase = createClient()
    setIsLoading(true)

    const redirectUrl = new URL(callbackPath, window.location.origin)
    redirectUrl.searchParams.set('next', nextPath)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl.toString(),
      },
    })

    if (error) {
      console.error('Google sign-in error:', error.message)
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      className={`w-full px-6 py-3 rounded border border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${className}`.trim()}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting...
        </>
      ) : (
        <>
          <GoogleIcon />
          Continue with Google
        </>
      )}
    </button>
  )
}
