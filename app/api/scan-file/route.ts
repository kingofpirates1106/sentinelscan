import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkFileScanLimit } from '@/lib/rate-limit'
import { createHash, randomUUID } from 'crypto'
import { TimeoutError, withTimeout } from '@/lib/timeout'

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY!
const IS_DEV = process.env.NODE_ENV !== 'production'
const HASH_ONLY_SIZE_BYTES = 50 * 1024 * 1024
const MAX_FILE_SIZE_BYTES = 128 * 1024 * 1024

async function computeSha256FromStream(file: File): Promise<string> {
  const reader = file.stream().getReader()
  const hash = createHash('sha256')
  let processedBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    processedBytes += value.byteLength
    if (processedBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error('File exceeds maximum supported size (128MB)')
    }

    hash.update(Buffer.from(value))
  }

  return hash.digest('hex')
}

async function submitFileForAnalysis(file: File) {
  const formData = new FormData()
  formData.append('file', file, file.name)

  const submitResponse = await withTimeout(
    async (signal) =>
      fetch('https://www.virustotal.com/api/v3/files', {
        method: 'POST',
        headers: {
          'x-apikey': VIRUSTOTAL_API_KEY,
        },
        body: formData,
        signal,
      }),
    15_000,
    'virustotal file submission'
  )

  if (!submitResponse.ok) {
    const responseBody = await submitResponse.text()
    console.error('[scan-file] VirusTotal submit failed', {
      status: submitResponse.status,
      body: responseBody,
    })
    throw new Error('Failed to submit file to VirusTotal')
  }

  const submitData = await submitResponse.json()
  const analysisId = submitData?.data?.id
  if (!analysisId) {
    throw new Error('No analysis ID returned from VirusTotal')
  }

  return {
    status: 'pending' as const,
    analysisId,
    raw: submitData,
  }
}

async function insertScanRecord({
  supabase,
  isAuthenticated,
  userId,
  sessionId,
  scanId,
  hash,
  createdAt,
  rawResponse,
}: {
  supabase: any
  isAuthenticated: boolean
  userId: string | null
  sessionId: string | null
  scanId: string
  hash: string
  createdAt: string
  rawResponse: Record<string, any>
}) {
  if (isAuthenticated && userId) {
    return supabase
      .from('scans')
      .insert({
        id: scanId,
        user_id: userId,
        scan_type: 'file',
        target_value: hash,
        stats: null,
        risk_level: 'unknown',
        raw_response: rawResponse,
        created_at: createdAt,
      })
      .select('id')
      .single()
  }

  return supabase
    .from('anonymous_scans')
    .insert({
      id: scanId,
      session_id: sessionId,
      scan_type: 'file',
      target_value: hash,
      stats: null,
      risk_level: 'unknown',
      raw_response: rawResponse,
      created_at: createdAt,
    })
    .select('id')
    .single()
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || typeof (file as File).stream !== 'function') {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const fileValue = file as File
    if (fileValue.size <= 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    if (fileValue.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds maximum supported size (128MB)' },
        { status: 413 }
      )
    }

    const hash = await computeSha256FromStream(fileValue)
    const isLargeFile = fileValue.size > HASH_ONLY_SIZE_BYTES
    const isVideoFile = fileValue.type.toLowerCase().startsWith('video/')
    const useHashLookupOnly = isLargeFile || isVideoFile

    const rawSessionId = request.headers.get('x-session-id')
    const authClient = await createClient()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    let sessionId = rawSessionId
    if (!user && (!sessionId || sessionId.trim().length === 0)) {
      sessionId = `anon_${randomUUID()}`
    }

    const supabase = await createClient(
      sessionId ? { headers: { 'x-session-id': sessionId } } : undefined
    )

    const limitResult = await checkFileScanLimit(user?.id ?? null, sessionId)
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: limitResult.error,
          limitReached: limitResult.limitReached ?? false,
          resetAt: limitResult.resetAt ?? null,
        },
        { status: limitResult.status }
      )
    }

    let scanId = randomUUID()
    const createdAt = new Date().toISOString()

    let rawResponse: Record<string, any>
    let analysisId: string | null = null

    if (useHashLookupOnly) {
      rawResponse = {
        status: 'pending',
        scan_mode: 'hash_lookup',
        analysis_id: null,
        hash_lookup_found: null,
        scan_reason: isVideoFile ? 'video_hash_lookup' : 'large_file_hash_lookup',
        hash_lookup_notice:
          'Large or unsupported media file detected. Scanning via SHA-256 hash lookup.',
        file_name: fileValue.name,
        file_size: fileValue.size,
      }
    } else {
      const submitResult = await submitFileForAnalysis(fileValue)
      analysisId = submitResult.analysisId
      rawResponse = {
        status: 'pending',
        analysis_id: submitResult.analysisId,
        submit_response: submitResult.raw || null,
        scan_mode: 'upload',
        file_name: fileValue.name,
        file_size: fileValue.size,
      }
    }

    const { data, error } = await insertScanRecord({
      supabase,
      isAuthenticated: Boolean(user),
      userId: user?.id ?? null,
      sessionId,
      scanId,
      hash,
      createdAt,
      rawResponse,
    })

    if (error) {
      console.error('[scan-file] DB insert error (pending):', error)
      return NextResponse.json(
        {
          error: 'Failed to store scan result',
          ...(IS_DEV ? { backend: error } : {}),
        },
        { status: 500 }
      )
    }

    scanId = data.id

    return NextResponse.json({
      success: true,
      scan: {
        id: scanId,
        fileName: fileValue.name,
        hash,
        status: 'pending',
        analysisId,
        threat_level: 'unknown',
        threatLevel: 'unknown',
        stats: null,
        hashLookupOnly: useHashLookupOnly,
      },
    })
  } catch (error) {
    console.error('[scan-file] Scan error:', error)
    const isTimeout = error instanceof TimeoutError
    return NextResponse.json(
      {
        error: isTimeout ? 'File submission timed out. Please retry.' : 'Failed to scan file',
        ...(IS_DEV
          ? {
              backend: {
                message: error instanceof Error ? error.message : String(error),
              },
            }
          : {}),
      },
      { status: 500 }
    )
  }
}
