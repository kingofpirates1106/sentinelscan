import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = (await request.json()) as { sessionId: string }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient(
      sessionId ? { headers: { 'x-session-id': sessionId } } : undefined
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get all anonymous scans with this session ID
    const { data: anonymousScans, error: fetchError } = await supabase
      .from('anonymous_scans')
      .select('scan_type, target_value, stats, risk_level, raw_response, created_at')
      .eq('session_id', sessionId)

    if (fetchError) {
      console.error('[v0] Error fetching anonymous scans:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch anonymous scans' },
        { status: 500 }
      )
    }

    // Move anonymous scans into the authenticated scans table
    if (anonymousScans && anonymousScans.length > 0) {
      const rows = anonymousScans.map((scan) => ({
        user_id: user.id,
        scan_type: scan.scan_type,
        target_value: scan.target_value,
        stats: scan.stats,
        risk_level: scan.risk_level,
        raw_response: scan.raw_response,
        created_at: scan.created_at,
      }))

      const { error: insertError } = await supabase
        .from('scans')
        .insert(rows)

      if (insertError) {
        console.error('[v0] Error inserting merged scans:', insertError)
        return NextResponse.json(
          { error: 'Failed to merge scans' },
          { status: 500 }
        )
      }

      const { error: deleteError } = await supabase
        .from('anonymous_scans')
        .delete()
        .eq('session_id', sessionId)

      if (deleteError) {
        console.error('[v0] Error deleting anonymous scans after merge:', deleteError)
        return NextResponse.json(
          { error: 'Failed to finalize merged scans' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      mergedCount: anonymousScans?.length || 0,
    })
  } catch (error) {
    console.error('[v0] Merge error:', error)
    return NextResponse.json(
      { error: 'Failed to merge scans' },
      { status: 500 }
    )
  }
}
