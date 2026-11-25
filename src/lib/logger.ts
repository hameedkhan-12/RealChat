import { getRequestId } from '@/lib/request-context'

type Level = 'info' | 'warn' | 'error'

function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
      .replace(/\+?\d[\d\s().-]{7,}\d/g, '[redacted-phone]')
  }
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/email|phone|name|message|token|secret|password/i.test(k)) out[k] = '[redacted]'
      else out[k] = redact(v)
    }
    return out
  }
  return value
}

function buildMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined
  const requestId = getRequestId()
  const out: Record<string, unknown> = { ...meta }
  if (requestId) out.requestId = requestId
  return redact(out) as Record<string, unknown>
}

export function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const metaOut = buildMeta(meta)
  const payload = { level, msg, ...(metaOut ? { meta: metaOut } : {}) }
  if (level === 'error') {
    console.error(JSON.stringify(payload))
    captureError(new Error(msg), { level, ...(metaOut ?? {}) })
  } else if (level === 'warn') {
    console.warn(JSON.stringify(payload))
  } else {
    console.info(JSON.stringify(payload))
  }
}

/** Send an error to Sentry when a DSN is configured. No-op otherwise (no hard dependency). */
export async function captureError(
  error: unknown,
  meta?: Record<string, unknown>,
): Promise<void> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  try {
    // Dynamic import via variable so @sentry/node remains an optional dependency
    // (only loaded when SENTRY_DSN is configured).
    const moduleName = '@sentry/node'
    const { init, captureException } = await import(moduleName)
    init({ dsn, tracesSampleRate: 0 })
    captureException(error, { extra: meta })
  } catch {
    // Sentry unavailable or misconfigured; the error is already logged above.
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
}
