import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { hashToken, getBearerToken } from '@/lib/session'
import { generateAvailableSlots } from '@/lib/slots'

export const GET = async (req: Request) => {
  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null
  if (!token) return NextResponse.json({ error: 'Missing session token' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to query params required' }, { status: 400 })
  }

  const tokenHash = hashToken(token)
  const room = await client.chatRoom.findFirst({
    where: { sessionTokenHash: tokenHash },
    include: { domain: true },
  })
  if (!room) return NextResponse.json({ error: 'Invalid session' }, { status: 403 })

  const domain = await client.domain.findUnique({
    where: { id: room.domainId },
    select: {
      slotMinutes: true,
      bufferMinutes: true,
      minNoticeHours: true,
      maxDaysAhead: true,
      timezone: true,
    },
  })
  if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 })

  const config = {
    slotMinutes: domain.slotMinutes,
    bufferMinutes: domain.bufferMinutes,
    minNoticeHours: domain.minNoticeHours,
    maxDaysAhead: domain.maxDaysAhead,
    timezone: domain.timezone,
  }

  const fromDate = new Date(from)
  const toDate = new Date(to)

  const slots = await generateAvailableSlots(room.domainId, config, fromDate, toDate)

  return NextResponse.json({ ok: true, slots, timezone: domain.timezone })
}
