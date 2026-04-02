import { NextRequest, NextResponse } from 'next/server'
import { getScanStatusById } from '@/lib/scan-status'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')?.trim()
  if (!id) {
    return NextResponse.json(
      { error: 'Missing scan id', status: 'failed' },
      { status: 400 }
    )
  }

  const sessionId = request.headers.get('x-session-id')
  const result = await getScanStatusById(id, sessionId)
  return NextResponse.json(result.body, { status: result.httpStatus ?? 200 })
}

