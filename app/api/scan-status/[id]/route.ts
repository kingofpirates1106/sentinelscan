import { NextRequest, NextResponse } from 'next/server'
import { getScanStatusById } from '@/lib/scan-status'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionId = request.headers.get('x-session-id')
  const result = await getScanStatusById(id, sessionId)
  return NextResponse.json(result.body, { status: result.httpStatus ?? 200 })
}

