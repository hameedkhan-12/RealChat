import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, readJson, assertSameOrigin, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { createSessionToken } from '@/lib/session'
import { verifyTurnstile } from '@/lib/widget-auth'
import { SessionBody } from '@/lib/validation'

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req)
  const ip = getClientIp(req)
  const minute = await rateLimit(`sess:ip:${ip}`, 10, 60)
  const day = await rateLimit(`sess:ipday:${ip}`, 100, 86_400)
  if (!minute.success || !day.success) throw new HttpError(429, 'RATE_LIMITED')

  const input = await readJson(req, SessionBody, 4096)

  const domain = await client.domain.findUnique({ where: { publicKey: input.key }, select: { id: true } })
  if (!domain) throw new HttpError(404, 'UNKNOWN_KEY')
  const perKey = await rateLimit(`sess:key:${input.key}`, 300, 60)
  if (!perKey.success) throw new HttpError(429, 'RATE_LIMITED')

  if (!(await verifyTurnstile(input.turnstileToken, ip))) throw new HttpError(403, 'BOT_CHECK_FAILED')

  const { token, hash } = createSessionToken()
  const result = await client.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: { domainId: domain.id },
      select: { id: true },
    })
    const room = await tx.chatRoom.create({
      data: {
        domainId: domain.id,
        customerId: customer.id,
        sessionTokenHash: hash,
        pageUrl: input.pageUrl ?? null,
        utm: input.utm ?? undefined,
        locale: input.locale ?? null,
      },
      select: { id: true },
    })
    return { customer, room }
  })
  return NextResponse.json(
    { ok: true, sessionToken: token, chatRoomId: result.room.id },
    { headers: { 'Cache-Control': 'no-store' } }
  )
})
