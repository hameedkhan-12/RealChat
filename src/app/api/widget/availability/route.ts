import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { hashToken, getBearerToken } from '@/lib/session'

export const GET = async (req: Request) => {
  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null
  if (!token) return NextResponse.json({ error: 'Missing session token' }, { status: 401 })

  const tokenHash = hashToken(token)
  const room = await client.chatRoom.findFirst({ where: { sessionTokenHash: tokenHash } })
  if (!room) return NextResponse.json({ error: 'Invalid session' }, { status: 403 })

  const bookings = await client.booking.findMany({
    where: { domainId: room.domainId },
    select: { startsAt: true, endsAt: true, status: true },
    orderBy: { startsAt: 'asc' },
  })

  const rules = await client.availabilityRule.findMany({
    where: { domainId: room.domainId },
    select: { weekday: true, startMinute: true, endMinute: true },
  })

  const exceptions = await client.availabilityException.findMany({
    where: { domainId: room.domainId },
    select: { date: true, closed: true },
  })

  return NextResponse.json({ ok: true, bookings, rules, exceptions })
}
