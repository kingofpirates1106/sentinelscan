'use client'

import React from "react"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mergeScansToUser } from '@/lib/session'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  mode?: 'login' | 'signup'
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  mode = 'login',
}: AuthModalProps) {
  const [currentMode, setCurrentMode] = useState<'login' | 'signup'>(mode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()

      if (currentMode === 'signup') {
        if (password !== repeatPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }

        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
              `${window.location.origin}/dashboard`,
          },
        })

        if (error) throw error

        // Merge scans
        if (data?.user?.id) {
          const sessionId = mergeScansToUser(data.user.id)
          if (sessionId) {
            await fetch('/api/merge-scans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            }).catch(() => {
              console.warn('[v0] Failed to merge scans')
            })
          }
        }

        onSuccess?.()
        onClose()
      } else {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        // Merge scans
        if (data?.user?.id) {
          const sessionId = mergeScansToUser(data.user.id)
          if (sessionId) {
            await fetch('/api/merge-scans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            }).catch(() => {
              console.warn('[v0] Failed to merge scans')
            })
          }
        }

        localStorage.setItem('showWelcomePopup', 'true')
        onSuccess?.()
        onClose()
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl p-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">
              {currentMode === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="text-neutral-400 text-sm">
              {currentMode === 'login'
                ? 'Sign in to access your scans'
                : 'Get unlimited scans and track your history'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2 rounded bg-neutral-900 border border-neutral-700 focus:border-white focus:outline-none text-white placeholder-neutral-600 text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded bg-neutral-900 border border-neutral-700 focus:border-white focus:outline-none text-white placeholder-neutral-600 text-sm"
                required
              />
            </div>

            {currentMode === 'signup' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">Confirm Password</label>
                <input
                  type="password"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-neutral-900 border border-neutral-700 focus:border-white focus:outline-none text-white placeholder-neutral-600 text-sm"
                  required
                />
              </div>
            )}

            {error && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 rounded bg-white text-black hover:bg-neutral-200 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading
                ? currentMode === 'login'
                  ? 'Signing in...'
                  : 'Creating account...'
                : currentMode === 'login'
                  ? 'Sign In'
                  : 'Sign Up'}
            </button>
          </form>

          <div className="space-y-3">
            <button
              onClick={() => {
                setCurrentMode(currentMode === 'login' ? 'signup' : 'login')
                setError('')
                setEmail('')
                setPassword('')
                setRepeatPassword('')
              }}
              className="w-full text-sm text-neutral-400 hover:text-white transition"
            >
              {currentMode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>

            <button
              onClick={onClose}
              className="w-full text-sm text-neutral-500 hover:text-neutral-400 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
