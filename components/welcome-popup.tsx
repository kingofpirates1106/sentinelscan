'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type WelcomePopupProps = {
  isOpen: boolean
  onClose: () => void
}

export function WelcomePopup({ isOpen, onClose }: WelcomePopupProps) {
  const [isNavigating, setIsNavigating] = useState(false)
  const router = useRouter()
  const navigateTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (navigateTimerRef.current !== null) {
        window.clearTimeout(navigateTimerRef.current)
      }
    }
  }, [])

  const handleNavigate = (path: string) => {
    if (isNavigating) return

    setIsNavigating(true)
    onClose()

    navigateTimerRef.current = window.setTimeout(() => {
      router.push(path)
      setIsNavigating(false)
    }, 200)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
        <h2 className="text-2xl font-bold">Welcome to SentinelScan</h2>
        <p className="mt-2 text-neutral-400">
          Start with these core features to secure your workflow:
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleNavigate('/url-scanner')}
            disabled={isNavigating}
            className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 text-left transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <p className="font-semibold text-cyan-300">URL Scanner</p>
            <p className="mt-1 text-sm text-neutral-400">
              Analyze links instantly before opening potentially unsafe sites.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('/file-scanner')}
            disabled={isNavigating}
            className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 text-left transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <p className="font-semibold text-cyan-300">File Scanner</p>
            <p className="mt-1 text-sm text-neutral-400">
              Upload files for malware and threat checks before execution.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('/security-insights')}
            disabled={isNavigating}
            className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 text-left transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
          >
            <p className="font-semibold text-cyan-300">Security Insights</p>
            <p className="mt-1 text-sm text-neutral-400">
              Explore current threat intelligence and practical protection guidance.
            </p>
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleNavigate('/')}
          disabled={isNavigating}
          className="mt-6 w-full rounded-md bg-white px-4 py-3 font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Get Started
        </button>
      </div>
    </div>
  )
}
