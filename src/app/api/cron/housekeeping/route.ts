import { NextResponse } from 'next/server'
import { handle, HttpError } from '@/lib/http'
import { client } from '@/lib/prisma'
import { sendMail } from '@/lib/mail'
import { getEnv } from '@/env'

export const POST = handle(async (req: Request) => {
  const auth = req.headers.get('authorization') || ''
  const secret = getEnv().CRON_SECRET
  if (!secret) throw new HttpError(500, 'CRON_NOT_CONFIGURED')
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  if (token !== secret) throw new HttpError(401, 'UNAUTHORIZED')

  const now = new Date()
  const results: string[] = []

  // ---- Booking reminders ----
  const HOUR_MS = 60 * 60 * 1000

  // 24h reminder: bookings starting within the next 24h, not yet reminded
  const in24h = new Date(now.getTime() + 24 * HOUR_MS)
  const due24h = await client.booking.findMany({
    where: {
      status: 'CONFIRMED',
      startsAt: { gte: now, lte: in24h },
      reminder24hSentAt: null,
    },
    select: { id: true, email: true, name: true, startsAt: true, endsAt: true, domain: { select: { name: true } } },
  })
  for (const b of due24h) {
    try {
      await sendMail({
        to: b.email ?? '',
        subject: `Reminder: your appointment tomorrow at ${b.domain.name}`,
        text: `Hi ${b.name || ''},\n\nThis is a reminder that you have an appointment with ${b.domain.name} tomorrow at ${b.startsAt.toLocaleString()}.\n`,
      })
      await client.booking.update({ where: { id: b.id }, data: { reminder24hSentAt: now } })
      results.push(`reminder24h:${b.id}`)
    } catch {
      // continue
    }
  }

  // 1h reminder: bookings starting within the next hour, not yet reminded
  const in1h = new Date(now.getTime() + HOUR_MS)
  const due1h = await client.booking.findMany({
    where: {
      status: 'CONFIRMED',
      startsAt: { gte: now, lte: in1h },
      reminder1hSentAt: null,
    },
    select: { id: true, email: true, name: true, startsAt: true, domain: { select: { name: true } } },
  })
  for (const b of due1h) {
    try {
      await sendMail({
        to: b.email ?? '',
        subject: `Reminder: your appointment in 1 hour at ${b.domain.name}`,
        text: `Hi ${b.name || ''},\n\nThis is a reminder that you have an appointment with ${b.domain.name} in 1 hour at ${b.startsAt.toLocaleString()}.\n`,
      })
      await client.booking.update({ where: { id: b.id }, data: { reminder1hSentAt: now } })
      results.push(`reminder1h:${b.id}`)
    } catch {
      // continue
    }
  }

  // ---- Housekeeping cleanup ----
  const env = getEnv()
  const retentionCutoff = new Date(now.getTime() - env.RETENTION_DAYS * 24 * 60 * 60 * 1000)

  // Close and anonymize old bot sessions
  const oldRooms = await client.chatRoom.findMany({
    where: { status: 'BOT', updatedAt: { lt: retentionCutoff } },
    select: { id: true, customerId: true },
  })
  for (const r of oldRooms) {
    await client.chatRoom.update({ where: { id: r.id }, data: { status: 'CLOSED' } })
  }
  results.push(`closedRooms:${oldRooms.length}`)

  return NextResponse.json({ ok: true, results }, { headers: { 'Cache-Control': 'no-store' } })
})
