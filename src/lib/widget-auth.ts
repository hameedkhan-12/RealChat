import 'server-only'
import { client } from '@/lib/prisma'
import { getEnv } from '@/env'
import { HttpError } from '@/lib/errors'
import { getBearerToken, hashToken } from '@/lib/session'

/** The ONLY way a widget route may identify a visitor. */
export async function requireWidgetSession(req: Request) {
  const token = getBearerToken(req)
  if (!token || token.length > 128) throw new HttpError(401, 'NO_SESSION')

  const room = await client.chatRoom.findUnique({
    where: { sessionTokenHash: hashToken(token) },
    include: { domain: { include: { chatBot: true } }, customer: true },
  })
  if (!room) throw new HttpError(401, 'INVALID_SESSION')

  const ttlMs = getEnv().WIDGET_SESSION_TTL_HOURS * 3_600_000
  if (Date.now() - room.lastActivityAt.getTime() > ttlMs) throw new HttpError(401, 'SESSION_EXPIRED')

  // touch at most once a minute to avoid a write on every request
  if (Date.now() - room.lastActivityAt.getTime() > 60_000) {
    await client.chatRoom.update({ where: { id: room.id }, data: { lastActivityAt: new Date() } })
  }
  return { room, domain: room.domain, customer: room.customer }
}

/** Server-side Turnstile check. Fails CLOSED. Only skipped when no secret is set outside production. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = getEnv().TURNSTILE_SECRET_KEY
  if (!secret) return getEnv().NODE_ENV !== 'production'
  if (!token) return false
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
