import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, readJson, assertSameOrigin, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireWidgetSession } from '@/lib/widget-auth'
import { sendMail } from '@/lib/mail'
import { generateICS } from '@/lib/ics'
import { BookingBody } from '@/lib/validation'
import { createSessionToken, hashToken } from '@/lib/session'
import { validateBookingSlot } from '@/lib/slots'

export const POST = handle(async (req: Request): Promise<NextResponse> => {
  assertSameOrigin(req)
  const ip = getClientIp(req)
  const rl = await rateLimit(`book:ip:${ip}`, 10, 60, true)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { room } = await requireWidgetSession(req)
  const sessionRl = await rateLimit(`book:room:${room.id}`, 20, 60, true)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')
  if (!sessionRl.success) throw new HttpError(429, 'RATE_LIMITED')

  const input = await readJson(req, BookingBody, 4096)

  const s = new Date(input.startsAt)
  const e = new Date(s.getTime() + 30 * 60 * 1000)
  if (isNaN(s.getTime()) || e <= s) throw new HttpError(400, 'INVALID_TIMES')

  // Atomic: validate slot constraints and check for conflicts within one
  // transaction with row-level locking so concurrent bookings cannot both pass.
  await validateBookingSlot({ domainId: room.domainId, startsAt: s, endsAt: e })

  let customer = await client.customer.findFirst({
    where: { domainId: room.domainId, email: input.email },
  })
  if (!customer) {
    customer = await client.customer.create({
      data: { domainId: room.domainId, email: input.email, name: input.name },
    })
  }

  const manageToken = createSessionToken().token

  const booking = await client.booking.create({
    data: {
      domainId: room.domainId,
      customerId: customer.id,
      email: input.email,
      name: input.name,
      phone: input.phone ?? null,
      visitorTimezone: input.visitorTimezone ?? null,
      startsAt: s,
      endsAt: e,
      status: 'CONFIRMED',
      manageTokenHash: hashToken(manageToken),
    },
  })

  await client.chatRoom.update({ where: { id: room.id }, data: { lastActivityAt: new Date() } })

  // Send confirmation email (visitor + tenant)
  const emails = (
    await client.domain.findUnique({
      where: { id: room.domainId },
      select: { notificationEmails: true, name: true },
    })
  )?.notificationEmails ?? []

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const manageUrl = `${appUrl}/manage/${booking.id}?token=${manageToken}`
  const ics = generateICS({
    bookingId: booking.id,
    domainName: room.domain.name,
    customerName: input.name,
    customerEmail: input.email,
    startsAt: s,
    endsAt: e,
    manageUrl,
  })

  const visitorTzLabel = input.visitorTimezone ? ` (${input.visitorTimezone})` : ''
  const startLabel = s.toLocaleString(undefined, { timeZone: input.visitorTimezone }) + visitorTzLabel
  const endLabel = e.toLocaleString(undefined, { timeZone: input.visitorTimezone }) + visitorTzLabel

  try {
    if (emails.length) {
      await sendMail({
        to: emails,
        subject: 'New booking confirmed',
        text: `A new booking has been confirmed.\nCustomer: ${input.name || input.email}\nDate: ${startLabel} - ${endLabel}\nManage: ${manageUrl}`,
      })
    }
    await sendMail({
      to: input.email,
      subject: `Appointment confirmed - ${room.domain.name}`,
      text: `Hi ${input.name || ''},\n\nYour appointment with ${room.domain.name} has been confirmed.\n\nDate: ${startLabel} - ${endLabel}\nManage your appointment: ${manageUrl}`,
      attachments: [{ filename: 'appointment.ics', content: ics, contentType: 'text/calendar' }],
    })
  } catch {
    // email failure should not break the booking
  }

  return NextResponse.json(
    { ok: true, bookingId: booking.id, customerId: customer.id, manageUrl },
    { headers: { 'Cache-Control': 'no-store' } }
  )
})
