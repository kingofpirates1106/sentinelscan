'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import GoogleSignInButton from '@/components/GoogleSignInButton'

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export default function Page() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showRepeatPassword, setShowRepeatPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Please enter a valid email address')
      setIsLoading(false)
      return
    }

    if (password !== repeatPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const data = (await response.json()) as { error?: string; message?: string }

      if (!response.ok) {
        setError(data.error || 'Unable to create account')
        setIsLoading(false)
        return
      }

      setMessage(data.message || 'Verification email sent')
      router.push(`/auth/sign-up-success?email=${encodeURIComponent(email.trim())}`)
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
          <h1 className="text-3xl font-bold">Create Account</h1>
          <p className="text-neutral-400">
            Sign up to get unlimited scans and track your history
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

        <form onSubmit={handleSignUp} className="space-y-4">
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

          <div className="space-y-2">
            <label className="block text-sm font-medium">Confirm Password</label>
            <div className="relative">
              <input
                type={showRepeatPassword ? 'text' : 'password'}
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded bg-neutral-900 border border-neutral-700 focus:border-white focus:outline-none text-white placeholder-neutral-600"
              />
              <button
                type="button"
                onClick={() => setShowRepeatPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-neutral-400 hover:text-white"
                aria-label={
                  showRepeatPassword
                    ? 'Hide confirm password'
                    : 'Show confirm password'
                }
              >
                {showRepeatPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
              {message}
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
                Creating account...
              </>
            ) : (
              'Sign Up'
            )}
          </button>
        </form>

        <div className="text-center text-sm text-neutral-400">
          Already have an account?{' '}
          <Link href="/login" className="text-white hover:underline font-medium">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
