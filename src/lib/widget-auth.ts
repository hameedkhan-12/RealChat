import crypto from 'crypto'
import { client } from '@/lib/prisma'
import { hashToken, getBearerToken, safeEqual } from '@/lib/session'

export async function getWidgetSession(req: Request) {
  const token = getBearerToken(req)
  if (!token) return null
  const tokenHash = hashToken(token)
  const room = await client.chatRoom.findFirst({
    where: { sessionTokenHash: tokenHash },
    include: { domain: { include: { chatBot: true } }, customer: true },
  })
  if (!room) return null
  // Expire after 24h inactivity (configurable later)
  const ttlHours = Number(process.env.WIDGET_SESSION_TTL_HOURS || 24)
  const inactiveMs = Date.now() - new Date(room.lastActivityAt).getTime()
  if (inactiveMs > ttlHours * 60 * 60 * 1000) return null
  // constant-time compare hash (defense in depth)
  if (!room.sessionTokenHash || !safeEqual(room.sessionTokenHash, tokenHash)) return null
  return { room, token, tokenHash }
}

export async function verifyTurnstile(token?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // allow in dev if not configured
  if (!token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
    const data = await res.json() as { success?: boolean }
    return !!data.success
  } catch {
    return false
  }
}
