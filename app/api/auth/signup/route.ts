import { resolveMx } from 'dns/promises'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

async function validateEmailDomain(email: string) {
  const domain = email.split('@')[1]
  if (!domain) return false
  try {
    const mxRecords = await resolveMx(domain)
    return mxRecords && mxRecords.length > 0
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string
      password?: string
    }

    const email = (body.email ?? '').trim().toLowerCase()
    const password = body.password ?? ''

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    const domainIsValid = await validateEmailDomain(email)
    if (!domainIsValid) {
      return NextResponse.json(
        { error: 'Email domain does not exist' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
      },
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      email,
      message: 'Verification email sent',
    })
  } catch (error) {
    console.error('[auth-signup] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Unable to create account right now. Please try again.' },
      { status: 500 }
    )
  }
}
