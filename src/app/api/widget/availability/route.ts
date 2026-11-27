import { NextResponse } from 'next/server'
import { handle, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireWidgetSession } from '@/lib/widget-auth'
import { client } from '@/lib/prisma'
import { generateAvailableSlots } from '@/lib/slots'
import { AvailabilityQuery } from '@/lib/validation'

export const GET = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`availability:${ip}`, 30, 60, true)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { room } = await requireWidgetSession(req)

  const { searchParams } = new URL(req.url)
  const input = AvailabilityQuery.parse({
    from: searchParams.get('from'),
    to: searchParams.get('to'),
  })

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
  if (!domain) throw new HttpError(404, 'DOMAIN_NOT_FOUND')

  const config = {
    slotMinutes: domain.slotMinutes,
    bufferMinutes: domain.bufferMinutes,
    minNoticeHours: domain.minNoticeHours,
    maxDaysAhead: domain.maxDaysAhead,
    timezone: domain.timezone,
  }

  const fromDate = new Date(input.from)
  const toDate = new Date(input.to)

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new HttpError(400, 'INVALID_TIMES')
  }

  const slots = await generateAvailableSlots(room.domainId, config, fromDate, toDate)

  return NextResponse.json({ ok: true, slots, timezone: domain.timezone })
})
