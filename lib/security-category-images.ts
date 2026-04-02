export type SecurityInsightCategory =
  | 'Threat Intel'
  | 'Malware'
  | 'Vulnerability'
  | 'Ransomware'
  | 'Web Security'
  | 'Data Breach'
  | 'Nation-State'
  | 'AI Security'
  | 'Cloud Security'
  | 'General Security'

const CATEGORY_IMAGE_MAP: Record<SecurityInsightCategory, string> = {
  'Threat Intel': '/images/category/threat-intel.svg',
  Malware: '/images/category/malware.svg',
  Vulnerability: '/images/category/vulnerability.svg',
  Ransomware: '/images/category/ransomware.svg',
  'Web Security': '/images/category/web-security.svg',
  'Data Breach': '/images/category/data-breach.svg',
  'Nation-State': '/images/category/nation-state.svg',
  'AI Security': '/images/category/ai-security.svg',
  'Cloud Security': '/images/category/cloud-security.svg',
  'General Security': '/images/category/general-security.svg',
}

function includesAny(blob: string, patterns: string[]): boolean {
  return patterns.some((pattern) => blob.includes(pattern))
}

export function deriveSecurityInsightCategory(
  title: string,
  description: string,
  source: string
): SecurityInsightCategory {
  const blob = `${title} ${description} ${source}`.toLowerCase()

  if (
    includesAny(blob, [
      'nation-state',
      'state-sponsored',
      'state sponsored',
      'apt ',
      'espionage',
      'intelligence agency',
      'geopolitical',
      'military cyber',
      'government-backed',
      'government backed',
    ])
  ) {
    return 'Nation-State'
  }

  if (
    includesAny(blob, [
      'data breach',
      'breach',
      'data leak',
      'leaked data',
      'exposed database',
      'records exposed',
      'stolen data',
      'credential dump',
    ])
  ) {
    return 'Data Breach'
  }

  if (
    includesAny(blob, [
      'ai ',
      'artificial intelligence',
      'llm',
      'model security',
      'prompt injection',
      'machine learning',
      'genai',
    ])
  ) {
    return 'AI Security'
  }

  if (
    includesAny(blob, [
      'cloud',
      'aws',
      'azure',
      'gcp',
      'kubernetes',
      'container',
      'iam',
      's3 bucket',
      'misconfiguration',
    ])
  ) {
    return 'Cloud Security'
  }

  if (
    includesAny(blob, [
      'ransomware',
      'ransom',
      'extortion',
      'lockbit',
      'cl0p',
      'blackcat',
      'encryptor',
    ])
  ) {
    return 'Ransomware'
  }

  if (
    includesAny(blob, [
      'malware',
      'trojan',
      'worm',
      'botnet',
      'spyware',
      'rootkit',
      'infostealer',
      'stealer',
      'payload',
    ])
  ) {
    return 'Malware'
  }

  if (
    includesAny(blob, [
      'vulnerability',
      'cve-',
      'zero-day',
      'zero day',
      'exploit',
      'patch',
      'security flaw',
      'privilege escalation',
      'rce',
    ])
  ) {
    return 'Vulnerability'
  }

  if (
    includesAny(blob, [
      'web security',
      'browser',
      'xss',
      'csrf',
      'sql injection',
      'owasp',
      'phishing',
      'domain spoofing',
      'session hijacking',
    ])
  ) {
    return 'Web Security'
  }

  if (
    includesAny(blob, [
      'threat intel',
      'campaign',
      'indicators of compromise',
      'ioc',
      'ttp',
      'threat actor',
      'active exploitation',
      'incident response',
    ])
  ) {
    return 'Threat Intel'
  }

  return 'General Security'
}

export function getCategoryFallbackImage(category: SecurityInsightCategory): string {
  return CATEGORY_IMAGE_MAP[category]
}

export function isValidCoverImageUrl(value: string | null | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/images/category/')) return true

  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function getIngestionCoverImage({
  title,
  description,
  source,
  extractedImageUrl,
}: {
  title: string
  description: string
  source: string
  extractedImageUrl: string | null | undefined
}): string {
  if (isValidCoverImageUrl(extractedImageUrl)) {
    return extractedImageUrl!.trim()
  }

  const category = deriveSecurityInsightCategory(title, description, source)
  return getCategoryFallbackImage(category)
}

