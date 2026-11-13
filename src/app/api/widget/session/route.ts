import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { createSessionToken, hashToken } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/widget-auth'
import { sessionSchema } from '@/lib/validation'

export const POST = async (req: Request) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const rl = await rateLimit(`sess:${ip}`, 30, 60)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = sessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { key: publicKey, turnstileToken } = parsed.data

  const domain = await client.domain.findUnique({ where: { publicKey } })
  if (!domain) return NextResponse.json({ error: 'Unknown domain key' }, { status: 404 })

  const turnstileOk = await verifyTurnstile(turnstileToken)
  if (!turnstileOk) return NextResponse.json({ error: 'Turnstile verification failed' }, { status: 403 })

  // Create Customer ONCE for this session
  const customer = await client.customer.create({
    data: { domainId: domain.id, email: body.customerEmail ?? null, name: body.customerName ?? null },
  })

  // Create ChatRoom ONCE for this session
  const chatRoom = await client.chatRoom.create({
    data: {
      domainId: domain.id,
      customerId: customer.id,
      status: 'BOT',
      sessionTokenHash: '',
      pageUrl: body.pageUrl || null,
      utm: body.utm ?? null,
    },
  })

  const { token, hash } = createSessionToken()
  await client.chatRoom.update({ where: { id: chatRoom.id }, data: { sessionTokenHash: hash } })

  return NextResponse.json({ ok: true, sessionToken: token, chatRoomId: chatRoom.id, domainId: domain.id })
}
