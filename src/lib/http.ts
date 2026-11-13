import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthError, HttpError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export { HttpError }

/** Reads a JSON body with a size limit and validates it with zod. */
export async function readJson<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
  maxBytes = 16_384
): Promise<z.infer<S>> {
  const ct = (req.headers.get('content-type') ?? '').toLowerCase()
  if (!ct.includes('application/json')) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE')
  const text = await req.text()
  if (new TextEncoder().encode(text).length > maxBytes) throw new HttpError(413, 'PAYLOAD_TOO_LARGE')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new HttpError(400, 'INVALID_JSON')
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION', {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  return parsed.data
}

/** Browsers always send Sec-Fetch-Site. Reject cross-site browser calls to session-bearing routes. */
export function assertSameOrigin(req: Request) {
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') throw new HttpError(403, 'CROSS_SITE_BLOCKED')
}

const NO_STORE = { 'Cache-Control': 'no-store' }

/** Wrap every route handler with this. Converts thrown errors into safe JSON responses. */
export function handle<A extends unknown[]>(fn: (req: Request, ...args: A) => Promise<Response>) {
  return async (req: Request, ...args: A): Promise<Response> => {
    try {
      return await fn(req, ...args)
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ ok: false, error: e.code, ...(e.extra ?? {}) }, { status: e.status, headers: NO_STORE })
      }
      if (e instanceof AuthError) {
        return NextResponse.json({ ok: false, error: e.code }, { status: e.status, headers: NO_STORE })
      }
      logger.error('route failed', {
        path: new URL(req.url).pathname,
        error: e instanceof Error ? e.message : String(e),
      })
      return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500, headers: NO_STORE })
    }
  }
}
