import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { hashToken, getBearerToken } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { generateICS } from '@/lib/ics'
import { formatICSTime } from '@/lib/timezone'

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
  const room = await client.chatRoom.findFirst({
    where: { sessionTokenHash: tokenHash },
    include: { domain: true },
  })
  if (!room) return NextResponse.json({ error: 'Invalid session' }, { status: 403 })

  const s = new Date(startsAt)
  const e = endsAt ? new Date(endsAt) : new Date(s.getTime() + 30 * 60 * 1000)

  // Transactional booking with conflict handling
  const conflict = await client.booking.findFirst({
    where: {
      domainId: room.domainId,
      status: 'CONFIRMED',
      startsAt: { lt: e },
      endsAt: { gt: s },
    },
  })
  if (conflict) {
    return NextResponse.json({ error: 'Slot no longer available', status: 409 })
  }

  let customer = await client.customer.findFirst({ where: { domainId: room.domainId, email: customerEmail } })
  if (!customer) {
    customer = await client.customer.create({ data: { domainId: room.domainId, email: customerEmail, name: customerName } })
  }

  const booking = await client.$transaction(async (tx) => {
    const existing = await tx.booking.findFirst({
      where: {
        domainId: room.domainId,
        status: 'CONFIRMED',
        startsAt: { lt: e },
        endsAt: { gt: s },
      },
    })
    if (existing) {
      throw new Error('SLOT_CONFLICT')
    }
    return tx.booking.create({
      data: {
        domainId: room.domainId,
        customerId: customer.id,
        email: customerEmail,
        name: customerName ?? null,
        startsAt: s,
        endsAt: e,
        status: 'CONFIRMED',
      },
    })
  })

  await client.chatRoom.update({ where: { id: room.id }, data: { lastActivityAt: new Date() } })

  // Send confirmation email to visitor
  const emails = room.domain.notificationEmails ?? []
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const manageUrl = `${appUrl}/manage/${booking.id}`

  try {
    const { sendMail } = await import('@/actions/mailer')
    const ics = generateICS({
      bookingId: booking.id,
      domainName: room.domain.name,
      customerName: customerName,
      customerEmail,
      startsAt: s,
      endsAt: e,
      manageUrl,
    })

    // Notify tenant
    if (emails.length) {
      await sendMail({
        to: emails,
        subject: 'New booking confirmed',
        text: `A new booking has been confirmed.\nCustomer: ${customerName || customerEmail}\nDate: ${s.toISOString()}\nManage: ${manageUrl}`,
      })
    }

    // Confirmation to visitor with .ics attachment (note: mailer currently doesn't support attachments,
    // but we include the .ics content in the body and the manage link)
    await sendMail({
      to: customerEmail,
      subject: `Appointment confirmed - ${room.domain.name}`,
      text: `Hi ${customerName || ''},\n\nYour appointment with ${room.domain.name} has been confirmed.\n\nDate: ${s.toLocaleString()}\nManage your appointment: ${manageUrl}\n\n${ics}`,
    })
  } catch {
    // email failure should not break the booking
  }

  return NextResponse.json({ ok: true, bookingId: booking.id, customerId: customer.id, manageUrl })
}
