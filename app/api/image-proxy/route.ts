import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

const DEFAULT_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'

export async function GET(request: NextRequest) {
  const encodedUrl = request.nextUrl.searchParams.get('url')
  if (!encodedUrl) {
    return new Response('Missing url', { status: 400 })
  }

  let targetUrl: URL
  try {
    targetUrl = new URL(encodedUrl)
  } catch {
    return new Response('Invalid url', { status: 400 })
  }

  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    return new Response('Unsupported protocol', { status: 400 })
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        'user-agent': 'SentinelScanImageProxy/1.0',
        accept: 'image/*,*/*;q=0.8',
      },
      cache: 'force-cache',
    })

    if (!upstream.ok) {
      return new Response('Upstream fetch failed', { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const cacheControl = upstream.headers.get('cache-control') || DEFAULT_CACHE_CONTROL
    const body = await upstream.arrayBuffer()

    return new Response(body, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': cacheControl,
      },
    })
  } catch {
    return new Response('Image proxy fetch failed', { status: 502 })
  }
}
