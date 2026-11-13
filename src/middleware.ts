import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/', '/auth(.*)', '/chatbot(.*)', '/embed.js',
  '/api/widget(.*)', '/api/pusher/auth', '/api/cron(.*)', '/api/manage(.*)', '/manage(.*)',
])

const KEY_RE = /^[0-9a-f]{32,64}$/i
const cache = new Map<string, { until: number; ancestors: string[] }>()

async function ancestorsFor(origin: string, key: string): Promise<string[]> {
  const hit = cache.get(key)
  if (hit && hit.until > Date.now()) return hit.ancestors
  try {
    const res = await fetch(`${origin}/api/widget/frame-policy?key=${encodeURIComponent(key)}`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = (await res.json()) as { ancestors?: unknown }
    const ancestors = Array.isArray(data.ancestors) ? data.ancestors.filter((x): x is string => typeof x === 'string') : []
    if (cache.size > 500) cache.clear()
    cache.set(key, { until: Date.now() + 30_000, ancestors })
    return ancestors
  } catch {
    return []
  }
}

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) await auth.protect()
  const res = NextResponse.next()
  if (request.nextUrl.pathname === '/chatbot') {
    const key = request.nextUrl.searchParams.get('key') ?? ''
    const ancestors = KEY_RE.test(key) ? await ancestorsFor(request.nextUrl.origin, key) : []
    res.headers.set('Content-Security-Policy', `frame-ancestors 'self' ${ancestors.join(' ')}`.trim())
  }
  return res
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
