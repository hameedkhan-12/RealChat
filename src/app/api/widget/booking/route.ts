import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { hashToken, getBearerToken } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'

export const POST = async (req: Request) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const rl = await rateLimit(`book:${ip}`, 10, 60)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null
  if (!token) return NextResponse.json({ error: 'Missing session token' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { startsAt, endsAt, customerEmail, customerName } = body || {}
  if (!startsAt || !customerEmail) return NextResponse.json({ error: 'startsAt and customerEmail required' }, { status: 400 })

  const tokenHash = hashToken(token)
  const room = await client.chatRoom.findFirst({ where: { sessionTokenHash: tokenHash } })
  if (!room) return NextResponse.json({ error: 'Invalid session' }, { status: 403 })

  let customer = await client.customer.findFirst({ where: { domainId: room.domainId, email: customerEmail } })
  if (!customer) {
    customer = await client.customer.create({ data: { domainId: room.domainId, email: customerEmail, name: customerName } })
  }

  const booking = await client.booking.create({
    data: {
      domainId: room.domainId,
      customerId: customer.id,
      email: customerEmail,
      name: customerName ?? null,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : new Date(new Date(startsAt).getTime() + 30 * 60 * 1000),
      status: 'CONFIRMED',
    },
  })

  await client.chatRoom.update({ where: { id: room.id }, data: { lastActivityAt: new Date() } })

  return NextResponse.json({ ok: true, bookingId: booking.id, customerId: customer.id })
}
