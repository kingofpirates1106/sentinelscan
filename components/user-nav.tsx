'use client'

import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

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

export function UserNav({ user }: { user: User | null }) {
  if (!user) {
    return (
      <div className="flex gap-4">
        <Link
          href="/login"
          className="text-sm px-4 py-2 rounded border border-neutral-700 hover:border-neutral-500 transition"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="text-sm px-4 py-2 rounded bg-white text-black hover:bg-neutral-200 transition font-medium"
        >
          Sign Up
        </Link>
      </div>
    )
  }

  const name = getDisplayName(user)
  const avatarUrl = getAvatarUrl(user)

  return (
    <div className="flex items-center gap-3">
      <div className="hidden lg:flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-1.5">
        <Avatar className="h-8 w-8 border border-neutral-700">
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback className="bg-neutral-800 text-neutral-200 text-xs font-semibold">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="leading-tight">
          <p className="text-sm font-medium text-white">{name}</p>
          <p className="text-xs text-neutral-400">{user.email}</p>
        </div>
      </div>

      <Link
        href="/dashboard"
        className="text-sm px-4 py-2 rounded border border-neutral-700 hover:border-neutral-500 transition"
      >
        Dashboard
      </Link>
      <form
        action="/auth/logout"
        method="post"
        className="text-sm px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 transition"
      >
        <button type="submit">Sign Out</button>
      </form>
    </div>
  )
}
