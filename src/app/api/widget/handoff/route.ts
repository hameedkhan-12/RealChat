import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { hashToken, getBearerToken } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'

export const POST = async (req: Request) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const rl = await rateLimit(`handoff:${ip}`, 10, 60)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null
  if (!token) return NextResponse.json({ error: 'Missing session token' }, { status: 401 })

  const tokenHash = hashToken(token)
  const room = await client.chatRoom.findFirst({
    where: { sessionTokenHash: tokenHash },
    include: { domain: true, customer: true },
  })
  if (!room) return NextResponse.json({ error: 'Invalid session' }, { status: 403 })

  await client.chatRoom.update({
    where: { id: room.id },
    data: { status: 'WAITING_AGENT', lastActivityAt: new Date() },
  })

  // Notify tenant via email (notificationEmails)
  const emails = room.domain.notificationEmails ?? []
  if (emails.length && room.customer) {
    try {
      const { sendMail } = await import('@/lib/mail')
      await sendMail({
        to: emails,
        subject: 'New chat handoff request',
        text: `A visitor requested to talk to a person. Customer: ${room.customer.email ?? room.customer.name ?? 'unknown'}. Chat room: ${room.id}`,
      })
    } catch {
      // email failure should not break the flow
    }
  }

  return NextResponse.json({ ok: true, chatRoomId: room.id, status: 'WAITING_AGENT' })
}
