import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      has_completed_onboarding: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update onboarding status', details: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
