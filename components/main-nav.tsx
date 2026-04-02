'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type NavItem = {
  href: string
  label: string
}

const navItems: NavItem[] = [
  { href: '/scan-url', label: 'URL Scanner' },
  { href: '/file-scanner', label: 'File & Screenshot Scanner' },
  { href: '/security-insights', label: 'Security Insights' },
  { href: '/scan-history', label: 'Scan History' },
  { href: '/about', label: 'About' },
]

function getDisplayName(user: User): string {
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const directName =
    typeof metadata?.name === 'string'
      ? metadata.name
      : typeof metadata?.full_name === 'string'
        ? metadata.full_name
        : typeof metadata?.user_name === 'string'
          ? metadata.user_name
          : ''

  if (directName.trim().length > 0) return directName.trim()
  if (user.email) return user.email.split('@')[0]
  return 'Account'
}

function getAvatarUrl(user: User): string {
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  return typeof metadata?.avatar_url === 'string' ? metadata.avatar_url : ''
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'SS'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function MainNav({ user }: { user: User | null }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const name = user ? getDisplayName(user) : ''
  const avatarUrl = user ? getAvatarUrl(user) : ''

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-700/40 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <Link
            href="/"
            className="shrink-0 text-xl font-bold tracking-tighter text-cyan-300 transition hover:text-cyan-200 lg:text-2xl"
          >
            SentinelScan
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-start md:flex">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 lg:gap-x-7">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-slate-300 transition hover:text-cyan-300"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex lg:gap-3">
          {!user ? (
            <>
              <Link
                href="/login"
                className="shrink-0 rounded border border-neutral-700 px-3 py-2 text-sm transition hover:border-neutral-500"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="shrink-0 rounded bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-neutral-200"
              >
                Sign Up
              </Link>
            </>
          ) : (
            <>
              <div className="hidden max-w-[16rem] items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-1.5 xl:flex">
                <Avatar className="h-8 w-8 shrink-0 border border-neutral-700">
                  <AvatarImage src={avatarUrl} alt={name} />
                  <AvatarFallback className="bg-neutral-800 text-xs font-semibold text-neutral-200">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-medium text-white">{name}</p>
                  <p className="truncate text-xs text-neutral-400">{user.email}</p>
                </div>
              </div>

              <Link
                href="/dashboard"
                className="shrink-0 rounded border border-neutral-700 px-3 py-2 text-sm transition hover:border-neutral-500"
              >
                Dashboard
              </Link>
              <form
                action="/auth/logout"
                method="post"
                className="shrink-0 rounded bg-neutral-800 px-3 py-2 text-sm transition hover:bg-neutral-700"
              >
                <button type="submit">Sign Out</button>
              </form>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-700 text-slate-200 transition hover:border-cyan-400/70 hover:text-cyan-300 md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      <div
        id="mobile-nav"
        className={`border-t border-slate-800/90 bg-slate-950/95 px-4 py-4 md:hidden ${mobileOpen ? 'block' : 'hidden'}`}
      >
        <div className="flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-2 py-2 text-sm text-slate-300 transition hover:bg-slate-900 hover:text-cyan-300"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="mt-4 border-t border-slate-800/80 pt-4">
          {!user ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/login"
                className="rounded border border-neutral-700 px-3 py-2 text-sm transition hover:border-neutral-500"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-neutral-200"
              >
                Sign Up
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-2">
                <Avatar className="h-8 w-8 shrink-0 border border-neutral-700">
                  <AvatarImage src={avatarUrl} alt={name} />
                  <AvatarFallback className="bg-neutral-800 text-xs font-semibold text-neutral-200">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{name}</p>
                  <p className="truncate text-xs text-neutral-400">{user.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/dashboard"
                  className="rounded border border-neutral-700 px-3 py-2 text-sm transition hover:border-neutral-500"
                >
                  Dashboard
                </Link>
                <form
                  action="/auth/logout"
                  method="post"
                  className="rounded bg-neutral-800 px-3 py-2 text-sm transition hover:bg-neutral-700"
                >
                  <button type="submit">Sign Out</button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

