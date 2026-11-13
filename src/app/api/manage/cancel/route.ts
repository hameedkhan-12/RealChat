import { NextResponse } from 'next/server'
import { handle, readJson, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { client } from '@/lib/prisma'
import { hashToken } from '@/lib/session'
import { ManageCancelBody } from '@/lib/validation'

export const POST = handle(async (req: Request) => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`cancel:ip:${ip}`, 20, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const input = await readJson(req, ManageCancelBody, 1024)

  const booking = await client.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, status: true, manageTokenHash: true, cancelledAt: true, domainId: true, email: true },
  })
  if (!booking) throw new HttpError(403, 'FORBIDDEN') // do not leak whether id exists
  if (booking.status !== 'CONFIRMED') throw new HttpError(409, 'ALREADY_CANCELLED')
  if (booking.cancelledAt) throw new HttpError(409, 'ALREADY_CANCELLED')
  if (!booking.manageTokenHash || hashToken(input.token) !== booking.manageTokenHash) throw new HttpError(403, 'FORBIDDEN')

  const updated = await client.booking.update({
    where: { id: input.bookingId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  })

  return NextResponse.json({ ok: true, bookingId: updated.id, status: updated.status })
})
