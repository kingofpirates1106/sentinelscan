'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { mergeScansToUser } from '@/lib/session'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import GoogleSignInButton from '@/components/GoogleSignInButton'

export default function Page() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        if (/email.*confirm/i.test(error.message)) {
          setError('Please verify your email before signing in.')
          return
        }
        throw error
      }

      if (data?.user?.email_confirmed_at == null) {
        await supabase.auth.signOut()
        setError('Please verify your email before signing in.')
        return
      }

      if (data?.user?.id) {
        const sessionId = mergeScansToUser(data.user.id)
        if (sessionId) {
          try {
            await fetch('/api/merge-scans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            })
          } catch (mergeError) {
            console.warn('[v0] Failed to merge scans:', mergeError)
          }
        }
      }

      localStorage.setItem('showWelcomePopup', 'true')
      router.push('/dashboard?auth=success')
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : 'Network error. Please check your connection and try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <Link href="/" className="text-2xl font-bold tracking-tighter block">
            SentinelScan
          </Link>
          <h1 className="text-3xl font-bold">Welcome Back</h1>
          <p className="text-neutral-400">
            Sign in to access your scan history and dashboard
          </p>
        </div>

        <div className="space-y-4">
          <GoogleSignInButton nextPath="/dashboard?auth=success" />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-neutral-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-black px-2 text-neutral-400">
                or continue with email
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded bg-neutral-900 border border-neutral-700 focus:border-white focus:outline-none text-white placeholder-neutral-600"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded bg-neutral-900 border border-neutral-700 focus:border-white focus:outline-none text-white placeholder-neutral-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-neutral-400 hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-3 rounded bg-white text-black hover:bg-neutral-200 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="text-center text-sm text-neutral-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-white hover:underline font-medium">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  )
}
