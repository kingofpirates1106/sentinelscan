const URGENCY_TERMS = [
  'immediately',
  'urgent',
  'verify now',
  'act now',
  'expires today',
  'expire',
  'suspended',
  'limited time',
  'account locked',
]

const BANKING_TERMS = [
  'bank',
  'payment',
  'wallet',
  'credit card',
  'debit card',
  'transaction',
  'otp',
  'pin',
  'routing number',
]

const SOCIAL_ENGINEERING_TERMS = [
  'click here',
  'confirm identity',
  'security alert',
  'unusual activity',
  'your account',
  'verify account',
  'update billing',
  'claim reward',
  'free gift',
]

const IMPERSONATION_TERMS = [
  'microsoft support',
  'apple support',
  'google security',
  'paypal team',
  'bank representative',
  'customer care',
  'help desk',
]

const MALWARE_POPUP_TERMS = [
  'virus detected',
  'trojan',
  'malware',
  'system infected',
  'scan your device',
  'call support',
  'windows defender warning',
]

const SHORT_LINK_DOMAINS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'shorturl.at',
  'rebrand.ly',
  'cutt.ly',
  'rb.gy',
])

const SUSPICIOUS_TLDS = new Set(['ru', 'xyz', 'top', 'click', 'work', 'gq', 'cf', 'tk'])

export type ScreenshotVerdict = 'Safe' | 'Suspicious' | 'Malicious'

export interface ScreenshotTextReport {
  extractedText: string
  threatSummary: string
  riskAnalysis: string
  finalVerdict: ScreenshotVerdict
  confidenceScore: number
  detectedIndicators: string[]
  highlightedKeywords: string[]
  suspiciousUrls: string[]
  recommendedAction: string
}

interface ExtractedUrls {
  all: string[]
  suspicious: string[]
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function extractMatches(textLower: string, terms: string[]): string[] {
  return terms.filter((term) => textLower.includes(term))
}

function findUrls(rawText: string): ExtractedUrls {
  const urls = rawText.match(/(?:https?:\/\/[^\s<>"')]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"')]+)?)/gi) ?? []
  const normalized = Array.from(new Set(urls.map((url) => url.trim().toLowerCase())))

  const suspicious = normalized.filter((url) => {
    const sanitized = url.replace(/^https?:\/\//, '')
    const hostname = sanitized.split('/')[0]
    const tld = hostname.split('.').pop() ?? ''
    const isShortener = SHORT_LINK_DOMAINS.has(hostname)
    const isIpLike = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
    const hasPunycode = hostname.includes('xn--')
    const hasAtSymbol = url.includes('@')
    const hasLoginBait = /(secure|verify|signin|login|account|update)/.test(url)
    const suspiciousTld = SUSPICIOUS_TLDS.has(tld)

    return isShortener || isIpLike || hasPunycode || hasAtSymbol || suspiciousTld || hasLoginBait
  })

  return { all: normalized, suspicious }
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num))
}

export function analyzeExtractedText(rawExtractedText: string): ScreenshotTextReport {
  const extractedText = normalizeText(rawExtractedText)
  const textLower = extractedText.toLowerCase()

  if (!extractedText) {
    return {
      extractedText: '',
      threatSummary: 'OCR could not confidently extract readable text from the screenshot.',
      riskAnalysis:
        'No readable text was detected, so phishing confidence is low. This may be a non-text screenshot or low-quality image.',
      finalVerdict: 'Suspicious',
      confidenceScore: 35,
      detectedIndicators: ['No readable OCR text found'],
      highlightedKeywords: [],
      suspiciousUrls: [],
      recommendedAction: 'Retake a clearer screenshot and avoid interacting until the source is verified.',
    }
  }

  const urgencyMatches = extractMatches(textLower, URGENCY_TERMS)
  const bankingMatches = extractMatches(textLower, BANKING_TERMS)
  const socialMatches = extractMatches(textLower, SOCIAL_ENGINEERING_TERMS)
  const impersonationMatches = extractMatches(textLower, IMPERSONATION_TERMS)
  const malwarePopupMatches = extractMatches(textLower, MALWARE_POPUP_TERMS)
  const urlResult = findUrls(extractedText)

  const indicators: string[] = []
  if (urgencyMatches.length > 0) indicators.push('Urgency-based pressure language detected')
  if (bankingMatches.length > 0) indicators.push('Banking or payment credential language detected')
  if (socialMatches.length > 0) indicators.push('Social engineering phrasing detected')
  if (impersonationMatches.length > 0) indicators.push('Possible impersonation branding detected')
  if (malwarePopupMatches.length > 0) indicators.push('Malware/scareware popup wording detected')
  if (urlResult.suspicious.length > 0) indicators.push('Suspicious URL patterns detected')
  if (urlResult.all.length > 0 && urlResult.suspicious.length === 0) indicators.push('URL(s) present - verify domain ownership')

  let riskScore = 5
  riskScore += urgencyMatches.length * 11
  riskScore += bankingMatches.length * 8
  riskScore += socialMatches.length * 8
  riskScore += impersonationMatches.length * 10
  riskScore += malwarePopupMatches.length * 12
  riskScore += urlResult.suspicious.length * 14

  const hasCredentialTargeting =
    /(password|passcode|otp|pin|security code|ssn|social security|card number)/.test(textLower)
  const hasActionLanguage = /(click|tap|verify|login|sign in|update|confirm)/.test(textLower)
  if (hasCredentialTargeting && hasActionLanguage) {
    riskScore += 18
    indicators.push('Credential harvesting pattern detected')
  }

  riskScore = clamp(riskScore, 0, 100)

  const verdict: ScreenshotVerdict =
    riskScore >= 70 ? 'Malicious' : riskScore >= 35 ? 'Suspicious' : 'Safe'

  const confidenceBase = 42 + indicators.length * 10 + Math.min(12, Math.floor(extractedText.length / 80))
  const confidenceScore = clamp(confidenceBase, 40, 98)

  const riskAnalysis =
    verdict === 'Malicious'
      ? 'The OCR text contains multiple high-risk phishing indicators (credential targeting, urgency, and suspicious links), which strongly suggests a malicious scam or impersonation attempt.'
      : verdict === 'Suspicious'
        ? 'The OCR text includes potentially deceptive elements such as urgency cues, account-verification prompts, or questionable URL patterns. Manual verification is required before trusting this content.'
        : 'No strong phishing patterns were found in the extracted text. The screenshot appears low-risk, but verify any links or login prompts before taking action.'

  const recommendedAction =
    verdict === 'Malicious'
      ? 'Do not click links or enter credentials. Report and delete the message/page, then verify account status from the official website directly.'
      : verdict === 'Suspicious'
        ? 'Avoid entering sensitive information until you confirm the sender and domain independently.'
        : 'Proceed cautiously and confirm domains before logging in or sharing sensitive data.'

  const highlightedKeywords = Array.from(
    new Set([
      ...urgencyMatches,
      ...bankingMatches,
      ...socialMatches,
      ...impersonationMatches,
      ...malwarePopupMatches,
    ])
  ).slice(0, 18)

  const threatSummary = `This screenshot says: ${extractedText.slice(0, 400)}${extractedText.length > 400 ? '...' : ''}`

  return {
    extractedText,
    threatSummary,
    riskAnalysis,
    finalVerdict: verdict,
    confidenceScore,
    detectedIndicators: indicators.length > 0 ? indicators : ['No major phishing indicators detected'],
    highlightedKeywords,
    suspiciousUrls: urlResult.suspicious,
    recommendedAction,
  }
}

interface TesseractRecognizeResult {
  data?: {
    text?: string
  }
}

interface TesseractLikeModule {
  recognize: (
    image: Buffer | Uint8Array | string,
    langs?: string,
    options?: Record<string, unknown>
  ) => Promise<TesseractRecognizeResult>
}

async function loadTesseractModule(): Promise<TesseractLikeModule | null> {
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<any>
    const mod = await dynamicImport('tesseract.js')
    const instance: TesseractLikeModule | undefined = mod?.default ?? mod
    if (!instance || typeof instance.recognize !== 'function') return null
    return instance
  } catch {
    return null
  }
}

export async function extractScreenshotTextWithOcr(file: File): Promise<{
  text: string
  engine: 'tesseract'
  available: boolean
  error?: string
}> {
  const tesseract = await loadTesseractModule()
  if (!tesseract) {
    return {
      text: '',
      engine: 'tesseract',
      available: false,
      error: 'Tesseract OCR module is not installed.',
    }
  }

  try {
    const imageBuffer = Buffer.from(await file.arrayBuffer())
    const result = await tesseract.recognize(imageBuffer, 'eng')
    const text = normalizeText(result?.data?.text ?? '')

    return {
      text,
      engine: 'tesseract',
      available: true,
    }
  } catch (error) {
    return {
      text: '',
      engine: 'tesseract',
      available: true,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
