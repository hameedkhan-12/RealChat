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

export function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const payload = { level, msg, ...(meta ? { meta: redact(meta) } : {}) }
  // Sentry hook placeholder
  if (level === 'error') console.error(JSON.stringify(payload))
  else if (level === 'warn') console.warn(JSON.stringify(payload))
  else console.info(JSON.stringify(payload))
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
}
