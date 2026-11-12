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
  toDate: Date,   // UTC
): Promise<TimeSlot[]> {
  const {
    slotMinutes,
    bufferMinutes,
    minNoticeHours,
    maxDaysAhead,
    timezone,
  } = config

  // Fetch availability rules
  const rules = await client.availabilityRule.findMany({
    where: { domainId },
    select: { weekday: true, startMinute: true, endMinute: true },
  })

  // Fetch exceptions (closed dates)
  const exceptions = await client.availabilityException.findMany({
    where: { domainId },
    select: { date: true, closed: true },
  })

  // Fetch confirmed bookings in the range
  const bookings = await client.booking.findMany({
    where: {
      domainId,
      status: 'CONFIRMED',
      startsAt: { gte: fromDate },
      endsAt: { lte: toDate },
    },
    select: { startsAt: true, endsAt: true },
  })

  // Build set of booked UTC intervals
  const bookedIntervals = bookings.map(b => ({
    start: b.startsAt.getTime(),
    end: b.endsAt.getTime(),
  }))

  // Build set of closed dates (YYYY-MM-DD in tenant tz)
  const closedDates = new Set<string>()
  exceptions.forEach(e => {
    if (e.closed) {
      const localDate = new Date(e.date.getTime())
      // e.date is stored as a Date (midnight UTC typically). Convert to local date string.
      closedDates.add(formatLocalDate(timezone, localDate))
    }
  })

  const slots: TimeSlot[] = []
  const now = new Date()
  const minNoticeMs = minNoticeHours * 60 * 60 * 1000
  const maxDaysMs = maxDaysAhead * 24 * 60 * 60 * 1000

  // Iterate day by day in tenant timezone
  let currentLocal = getLocalDateParts(timezone, now)
  currentLocal.hour = 0
  currentLocal.minute = 0

  const maxDate = new Date(now.getTime() + maxDaysMs)

  for (let dayOffset = 0; dayOffset <= maxDaysAhead; dayOffset++) {
    const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000)
    const localParts = getLocalDateParts(timezone, targetDate)
    const dateStr = `${localParts.year}-${String(localParts.month + 1).padStart(2, '0')}-${String(localParts.day).padStart(2, '0')}`

    // Skip if past min notice for today
    if (dayOffset === 0) {
      const nowUtcMs = now.getTime()
      const minNoticeUtcMs = nowUtcMs + minNoticeMs
      // We'll check per-slot below
    }

    // Check if this date is closed
    if (closedDates.has(dateStr)) continue

    // Get weekday
    const weekday = localParts.day // getDay() equivalent - but we need actual weekday
    // getLocalDateParts doesn't return weekday. Use getUTCDay on a local date.
    const weekdayDate = new Date(Date.UTC(localParts.year, localParts.month, localParts.day))
    const dayOfWeek = weekdayDate.getUTCDay() // This is UTC day, but for date-only it's close enough
    // Actually we need the local weekday. Let's compute properly:
    const localWeekday = new Date(localParts.year, localParts.month, localParts.day).getDay()

    const dayRules = rules.filter(r => r.weekday === localWeekday)
    if (dayRules.length === 0) continue

    // For each rule, generate slots
    for (const rule of dayRules) {
      // Start time in local tz
      let slotStartLocalMin = rule.startMinute
      const slotEndLocalMin = rule.endMinute

      while (slotStartLocalMin + slotMinutes <= slotEndLocalMin) {
        const slotStartUTC = localToUTC(timezone, localParts.year, localParts.month, localParts.day,
          Math.floor(slotStartLocalMin / 60), slotStartLocalMin % 60)
        const slotEndUTC = addMinutes(slotStartUTC, slotMinutes)

        // Check min notice
        if (slotStartUTC.getTime() < now.getTime() + minNoticeMs) {
          slotStartLocalMin += slotMinutes + bufferMinutes
          continue
        }

        // Check max days ahead
        if (slotStartUTC.getTime() > maxDate.getTime()) {
          slotStartLocalMin += slotMinutes + bufferMinutes
          continue
        }

        // Check conflicts with bookings
        const slotStartMs = slotStartUTC.getTime()
        const slotEndMs = slotEndUTC.getTime()
        const conflict = bookedIntervals.some(b =>
          slotStartMs < b.end && slotEndMs > b.start
        )

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

    // Move to next day
    currentLocal.day++
    if (currentLocal.day > 31) {
      currentLocal.month++
      currentLocal.day = 1
    }
    if (currentLocal.month > 11) {
      currentLocal.year++
      currentLocal.month = 0
    }
  }

  return slots
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
