import { client } from '@/lib/prisma'
import {
  getTimezoneOffsetMinutes,
  getLocalDateParts,
  localToUTC,
  addMinutes,
  formatLocalDate,
  isSameDay,
  formatLocalTime,
} from '@/lib/timezone'

export type TimeSlot = {
  start: Date // UTC
  end: Date   // UTC
  startLocal: string // HH:mm in tenant tz
  endLocal: string
  dateLocal: string  // YYYY-MM-DD in tenant tz
  available: boolean
}

export type AvailabilityRule = {
  weekday: number // 0 = Sunday
  startMinute: number // minutes from midnight
  endMinute: number
}

export type AvailabilityException = {
  date: Date // YYYY-MM-DD in tenant tz
  closed: boolean
}

export type BookingSlotConfig = {
  slotMinutes: number
  bufferMinutes: number
  minNoticeHours: number
  maxDaysAhead: number
  timezone: string
}

/**
 * Generate available time slots for a domain over a date range.
 */
export async function generateAvailableSlots(
  domainId: string,
  config: BookingSlotConfig,
  fromDate: Date, // UTC
  toDate: Date,   // UTC (upper bound, inclusive)
): Promise<TimeSlot[]> {
  const {
    slotMinutes,
    bufferMinutes,
    minNoticeHours,
    maxDaysAhead,
    timezone,
  } = config

  const pad = (n: number) => n.toString().padStart(2, '0')

  // Fetch availability rules
  const rules = await client.availabilityRule.findMany({
    where: { domainId },
    select: { weekday: true, startMinute: true, endMinute: true },
  })

  // Fetch exceptions (closed dates), keyed by calendar date in the tenant's timezone.
  // @db.Date values are calendar dates; read their UTC components directly so a tenant
  // west of UTC is not off by one (P15).
  const exceptions = await client.availabilityException.findMany({
    where: { domainId },
    select: { date: true, closed: true },
  })
  const closedDates = new Set<string>()
  exceptions.forEach((e) => {
    if (e.closed) {
      closedDates.add(`${e.date.getUTCFullYear()}-${pad(e.date.getUTCMonth() + 1)}-${pad(e.date.getUTCDate())}`)
    }
  })

  // Fetch confirmed bookings in the UTC range
  const bookings = await client.booking.findMany({
    where: {
      domainId,
      status: 'CONFIRMED',
      startsAt: { gte: fromDate },
      endsAt: { lte: toDate },
    },
    select: { startsAt: true, endsAt: true },
  })
  const bookedIntervals = bookings.map((b) => ({
    start: b.startsAt.getTime(),
    end: b.endsAt.getTime(),
  }))

  const slots: TimeSlot[] = []
  const now = new Date()
  const minNoticeMs = minNoticeHours * 60 * 60 * 1000

  // Hard cap: never generate more than maxDaysAhead days, regardless of requested range.
  const maxTo = new Date(fromDate.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000)
  const toBound = toDate.getTime() < maxTo.getTime() ? toDate : maxTo

  // Iterate by LOCAL date (calendar day in tenant tz), not by +24h UTC (breaks across DST, P16).
  let local = getLocalDateParts(timezone, fromDate)
  local.hour = 0
  local.minute = 0

  while (true) {
    const dateStr = `${local.year}-${pad(local.month + 1)}-${pad(local.day)}`

    // Stop once we pass the upper bound (compare local date to toBound rendered in tz)
    const toBoundLocal = getLocalDateParts(timezone, toBound)
    if (
      local.year > toBoundLocal.year ||
      (local.year === toBoundLocal.year && local.month > toBoundLocal.month) ||
      (local.year === toBoundLocal.year && local.month === toBoundLocal.month && local.day > toBoundLocal.day)
    ) {
      break
    }

    // Skip closed dates (P15)
    if (closedDates.has(dateStr)) {
      local = nextLocalDay(local)
      continue
    }

    const localWeekday = new Date(local.year, local.month, local.day).getDay()
    const dayRules = rules.filter((r) => r.weekday === localWeekday)
    if (dayRules.length === 0) {
      local = nextLocalDay(local)
      continue
    }

    for (const rule of dayRules) {
      let slotStartLocalMin = rule.startMinute
      const slotEndLocalMin = rule.endMinute

      while (slotStartLocalMin + slotMinutes <= slotEndLocalMin) {
        const slotStartUTC = localToUTC(
          timezone,
          local.year,
          local.month,
          local.day,
          Math.floor(slotStartLocalMin / 60),
          slotStartLocalMin % 60
        )
        const slotEndUTC = addMinutes(slotStartUTC, slotMinutes)

        // Min notice
        if (slotStartUTC.getTime() < now.getTime() + minNoticeMs) {
          slotStartLocalMin += slotMinutes + bufferMinutes
          continue
        }

        // Respect upper bound
        if (slotStartUTC.getTime() > toBound.getTime()) {
          slotStartLocalMin += slotMinutes + bufferMinutes
          continue
        }

        const slotStartMs = slotStartUTC.getTime()
        const slotEndMs = slotEndUTC.getTime()
        const conflict = bookedIntervals.some((b) => slotStartMs < b.end && slotEndMs > b.start)

        if (!conflict) {
          slots.push({
            start: slotStartUTC,
            end: slotEndUTC,
            startLocal: formatLocalTime(timezone, slotStartUTC),
            endLocal: formatLocalTime(timezone, slotEndUTC),
            dateLocal: dateStr,
            available: true,
          })
        }

        slotStartLocalMin += slotMinutes + bufferMinutes
      }
    }

    local = nextLocalDay(local)
  }

  return slots
}

function nextLocalDay(d: { year: number; month: number; day: number; hour: number; minute: number }) {
  const next = new Date(Date.UTC(d.year, d.month, d.day + 1))
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth(),
    day: next.getUTCDate(),
    hour: 0,
    minute: 0,
  }
}

export async function checkSlotConflict(
  domainId: string,
  startsAt: Date,
  endsAt: Date
): Promise<boolean> {
  const existing = await client.booking.findFirst({
    where: {
      domainId,
      status: 'CONFIRMED',
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  })
  return !!existing
}
