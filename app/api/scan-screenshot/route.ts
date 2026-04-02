import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkScreenshotScanLimit } from '@/lib/rate-limit'
import {
  analyzeExtractedText,
  extractScreenshotTextWithOcr,
  type ScreenshotVerdict,
} from '@/lib/screenshot-text-analysis'

const IS_DEV = process.env.NODE_ENV !== 'production'
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpg',
  'image/jpeg',
  'image/webp',
])

type InsertRecord = {
  id: string
  scan_type: 'screenshot'
  target_value: string
  stats: Record<string, unknown> | null
  risk_level: 'safe' | 'suspicious' | 'dangerous'
  raw_response: Record<string, unknown>
  created_at: string
  result?: Record<string, unknown>
  safety_score?: number
  user_id?: string
  session_id?: string | null
}

function toDbRiskLevel(level: ScreenshotVerdict): 'safe' | 'suspicious' | 'dangerous' {
  if (level === 'Malicious') return 'dangerous'
  if (level === 'Suspicious') return 'suspicious'
  return 'safe'
}

function isMissingColumnError(error: any): boolean {
  const message = String(error?.message ?? '')
  return (
    error?.code === 'PGRST204' ||
    message.includes('Could not find the') ||
    message.includes('column') ||
    message.includes('does not exist')
  )
}

async function insertWithFallback(supabase: any, table: 'scans' | 'anonymous_scans', record: InsertRecord) {
  const withExtended = { ...record }
  const { data: extendedData, error: extendedError } = await supabase
    .from(table)
    .insert(withExtended)
    .select('id')
    .single()

  if (!extendedError) return { data: extendedData, error: null }
  if (!isMissingColumnError(extendedError)) return { data: null, error: extendedError }

  const withoutResultAndScore = { ...record }
  delete withoutResultAndScore.result
  delete withoutResultAndScore.safety_score

  const fallback = await supabase
    .from(table)
    .insert(withoutResultAndScore)
    .select('id')
    .single()

  return fallback
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || typeof (file as File).arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }

    const uploadedFile = file as File
    const mime = uploadedFile.type.toLowerCase()

    if (!SUPPORTED_IMAGE_TYPES.has(mime)) {
      return NextResponse.json(
        { error: 'Only PNG, JPG, JPEG, and WEBP screenshot uploads are supported.' },
        { status: 400 }
      )
    }

    if (uploadedFile.size <= 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    if (uploadedFile.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Screenshot exceeds max size (10 MB)' },
        { status: 413 }
      )
    }

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

    const limitResult = await checkScreenshotScanLimit(user?.id ?? null, sessionId)
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

    const ocrResult = await extractScreenshotTextWithOcr(uploadedFile)
    if (!ocrResult.available) {
      return NextResponse.json(
        {
          error: 'OCR engine unavailable. Install tesseract.js and retry screenshot analysis.',
          ...(IS_DEV ? { backend: { ocr: ocrResult.error ?? 'OCR module unavailable' } } : {}),
        },
        { status: 503 }
      )
    }

    const analysis = analyzeExtractedText(ocrResult.text)
    const riskLevel = toDbRiskLevel(analysis.finalVerdict)
    const riskScore =
      analysis.finalVerdict === 'Malicious' ? 90 : analysis.finalVerdict === 'Suspicious' ? 55 : 15
    const safetyScore = Math.max(0, Math.min(100, 100 - riskScore))
    const scanId = randomUUID()
    const createdAt = new Date().toISOString()

    const structuredResult = {
      extractedText: analysis.extractedText,
      threatSummary: analysis.threatSummary,
      riskAnalysis: analysis.riskAnalysis,
      finalVerdict: analysis.finalVerdict,
      confidenceScore: analysis.confidenceScore,
      detectedIndicators: analysis.detectedIndicators,
      highlightedKeywords: analysis.highlightedKeywords,
      suspiciousUrls: analysis.suspiciousUrls,
      recommendedAction: analysis.recommendedAction,
      riskLevel: analysis.finalVerdict,
      isScreenshot: true,
    }

    const baseRecord: InsertRecord = {
      id: scanId,
      scan_type: 'screenshot',
      target_value: uploadedFile.name,
      stats: { safety_score: safetyScore },
      risk_level: riskLevel,
      raw_response: {
        analyzer: 'ocr_text_intelligence',
        ocr_engine: ocrResult.engine,
        ocr_available: ocrResult.available,
        ocr_error: ocrResult.error ?? null,
        mime_type: mime,
        file_name: uploadedFile.name,
        file_size: uploadedFile.size,
        result: structuredResult,
        confidence_score: analysis.confidenceScore,
        final_verdict: analysis.finalVerdict,
        safety_score: safetyScore,
      },
      result: structuredResult,
      safety_score: safetyScore,
      created_at: createdAt,
    }

    const table: 'scans' | 'anonymous_scans' = user ? 'scans' : 'anonymous_scans'
    const record = user
      ? { ...baseRecord, user_id: user.id }
      : { ...baseRecord, session_id: sessionId ?? null }

    const { data, error } = await insertWithFallback(supabase, table, record)

    if (error) {
      console.error('[scan-screenshot] DB insert error:', error)
      return NextResponse.json(
        {
          error: 'Failed to store screenshot analysis result',
          ...(IS_DEV ? { backend: error } : {}),
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      scan: {
        id: data?.id ?? scanId,
        fileName: uploadedFile.name,
        status: 'completed',
        threat_level: riskLevel,
        threatLevel: riskLevel,
        scanType: 'screenshot',
        safetyScore,
        confidenceScore: analysis.confidenceScore,
        report: structuredResult,
      },
    })
  } catch (error) {
    console.error('[scan-screenshot] Screenshot analysis error:', error)
    return NextResponse.json(
      {
        error: 'Failed to analyze screenshot',
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
