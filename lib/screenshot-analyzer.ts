import { TimeoutError, withTimeout } from '@/lib/timeout'

export type ScreenshotRiskLevel = 'Safe' | 'Suspicious' | 'Malicious'

export interface ScreenshotAnalysisReport {
  threatSummary: string
  riskLevel: ScreenshotRiskLevel
  detectedIndicators: string[]
  recommendedAction: string
  safetyScore: number
  isScreenshot: boolean
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_SCREENSHOT_MODEL ?? 'gpt-4.1-mini'

function parseJsonFromText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()

  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    // Continue: model may wrap JSON in markdown code fences.
  }

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>
    } catch {
      return null
    }
  }

  return null
}

function normalizeRiskLevel(value: unknown): ScreenshotRiskLevel {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (normalized === 'malicious') return 'Malicious'
  if (normalized === 'suspicious') return 'Suspicious'
  return 'Safe'
}

function normalizeIndicators(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .slice(0, 12)
}

function fallbackSafetyScore(riskLevel: ScreenshotRiskLevel): number {
  if (riskLevel === 'Safe') return 90
  if (riskLevel === 'Suspicious') return 55
  return 15
}

function normalizeSafetyScore(value: unknown, riskLevel: ScreenshotRiskLevel): number {
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(100, Math.round(numeric)))
  }
  return fallbackSafetyScore(riskLevel)
}

function ensureReportShape(payload: Record<string, unknown>): ScreenshotAnalysisReport {
  const riskLevel = normalizeRiskLevel(payload.riskLevel)
  const detectedIndicators = normalizeIndicators(payload.detectedIndicators)

  return {
    threatSummary:
      typeof payload.threatSummary === 'string' && payload.threatSummary.trim().length > 0
        ? payload.threatSummary.trim()
        : 'The uploaded screenshot was analyzed for social engineering and phishing signals.',
    riskLevel,
    detectedIndicators:
      detectedIndicators.length > 0
        ? detectedIndicators
        : ['No high-confidence indicators were extracted from the screenshot.'],
    recommendedAction:
      typeof payload.recommendedAction === 'string' && payload.recommendedAction.trim().length > 0
        ? payload.recommendedAction.trim()
        : 'Verify the sender and destination domain before taking any action.',
    safetyScore: normalizeSafetyScore(payload.safetyScore, riskLevel),
    isScreenshot: Boolean(payload.isScreenshot ?? true),
  }
}

export async function analyzeScreenshotWithAI(file: File): Promise<ScreenshotAnalysisReport> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type || 'image/png'

  const prompt = `
You are a cybersecurity screenshot analyst.
Assess whether the image is a screenshot and detect:
- phishing login forms
- fake banking pages
- suspicious URLs/domains
- malware popups
- impersonation attempts
- scam messages and urgency tactics
- fake security warnings

Return strict JSON with this exact shape:
{
  "threatSummary": "short paragraph",
  "riskLevel": "Safe" | "Suspicious" | "Malicious",
  "detectedIndicators": ["bullet-like strings"],
  "recommendedAction": "one clear recommendation",
  "safetyScore": number from 0 to 100,
  "isScreenshot": boolean
}
`

  const response = await withTimeout(
    async (signal) =>
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content:
                'You analyze screenshots for cybersecurity threats and output strict JSON only.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mediaType};base64,${base64}`,
                  },
                },
              ],
            },
          ],
        }),
        signal,
      }),
    25_000,
    'openai screenshot analysis'
  )

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`AI analysis request failed (${response.status}): ${details}`)
  }

  const data = (await response.json()) as any
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('AI analysis returned an unexpected response format')
  }

  const parsed = parseJsonFromText(content)
  if (!parsed) {
    throw new Error('AI analysis response could not be parsed as JSON')
  }

  return ensureReportShape(parsed)
}

export { TimeoutError }
