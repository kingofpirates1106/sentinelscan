// VirusTotal API integration for URL and file scanning
// Handles communication with VirusTotal API and result processing

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY
const VIRUSTOTAL_BASE_URL = 'https://www.virustotal.com/api/v3'

export type RiskLevel = 'safe' | 'suspicious' | 'malicious' | 'unknown'

export interface ScanResult {
  target: string
  scan_type: 'url' | 'file' | 'screenshot'
  risk_level: RiskLevel
  scan_result: Record<string, any>
  stats?: {
    harmless: number
    malicious: number
    suspicious: number
    undetected: number
  }
}

export async function scanURL(url: string): Promise<ScanResult> {
  if (!VIRUSTOTAL_API_KEY) {
    console.error('[v0] VIRUSTOTAL_API_KEY not configured')
    return {
      target: url,
      scan_type: 'url',
      risk_level: 'unknown',
      scan_result: { error: 'VirusTotal API key not configured' },
    }
  }

  try {
    // First, submit the URL for analysis
    const analysisResponse = await fetch(`${VIRUSTOTAL_BASE_URL}/urls`, {
      method: 'POST',
      headers: {
        'x-apikey': VIRUSTOTAL_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ url }),
    })

    if (!analysisResponse.ok) {
      throw new Error(`VirusTotal API error: ${analysisResponse.statusText}`)
    }

    const analysisData = await analysisResponse.json() as any
    const analysisId = analysisData.data.id

    // Give it a moment to process
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Get the analysis results
    const resultsResponse = await fetch(
      `${VIRUSTOTAL_BASE_URL}/analyses/${analysisId}`,
      {
        headers: { 'x-apikey': VIRUSTOTAL_API_KEY },
      }
    )

    if (!resultsResponse.ok) {
      throw new Error(`Failed to fetch VirusTotal results`)
    }

    const resultsData = await resultsResponse.json() as any
    const stats = resultsData.data.attributes.stats || {
      harmless: 0,
      malicious: 0,
      suspicious: 0,
      undetected: 0,
    }

    const riskLevel = determineRiskLevel(stats)

    return {
      target: url,
      scan_type: 'url',
      risk_level: riskLevel,
      scan_result: resultsData.data.attributes,
      stats,
    }
  } catch (error) {
    console.error('[v0] URL scan error:', error)
    return {
      target: url,
      scan_type: 'url',
      risk_level: 'unknown',
      scan_result: { error: String(error) },
    }
  }
}

export async function scanFile(fileHash: string): Promise<ScanResult> {
  if (!VIRUSTOTAL_API_KEY) {
    console.error('[v0] VIRUSTOTAL_API_KEY not configured')
    return {
      target: fileHash,
      scan_type: 'file',
      risk_level: 'unknown',
      scan_result: { error: 'VirusTotal API key not configured' },
    }
  }

  try {
    const response = await fetch(
      `${VIRUSTOTAL_BASE_URL}/files/${fileHash}`,
      {
        headers: { 'x-apikey': VIRUSTOTAL_API_KEY },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        // File not found in VirusTotal, treat as unknown
        return {
          target: fileHash,
          scan_type: 'file',
          risk_level: 'unknown',
          scan_result: { error: 'File not found in VirusTotal' },
        }
      }
      throw new Error(`VirusTotal API error: ${response.statusText}`)
    }

    const data = await response.json() as any
    const stats = data.data.attributes.last_analysis_stats || {
      harmless: 0,
      malicious: 0,
      suspicious: 0,
      undetected: 0,
    }

    const riskLevel = determineRiskLevel(stats)

    return {
      target: fileHash,
      scan_type: 'file',
      risk_level: riskLevel,
      scan_result: data.data.attributes,
      stats,
    }
  } catch (error) {
    console.error('[v0] File scan error:', error)
    return {
      target: fileHash,
      scan_type: 'file',
      risk_level: 'unknown',
      scan_result: { error: String(error) },
    }
  }
}

export function determineRiskLevel(stats: {
  harmless: number
  malicious: number
  suspicious: number
  undetected: number
}): RiskLevel {
  if (stats.malicious > 0) return 'malicious'
  if (stats.suspicious > 0) return 'suspicious'
  if (stats.harmless > 0) return 'safe'
  return 'unknown'
}
