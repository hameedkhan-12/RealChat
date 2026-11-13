/**
 * Get the offset in minutes for a given IANA timezone at a specific date.
 */
export function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()))
  
  // Create a date in the target timezone by formatting
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  
  const parts = formatter.formatToParts(utcDate)
  const partMap: Record<string, string> = {}
  parts.forEach(p => { partMap[p.type] = p.value })
  
  const tzYear = parseInt(partMap.year, 10)
  const tzMonth = parseInt(partMap.month, 10) - 1
  const tzDay = parseInt(partMap.day, 10)
  const tzHour = parseInt(partMap.hour, 10)
  const tzMinute = parseInt(partMap.minute, 10)
  
  const localTime = Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute)
  const utcTime = utcDate.getTime()
  
  // Offset in minutes: (local - utc) / 60000
  // If local is ahead of UTC, offset is positive
  return Math.round((localTime - utcTime) / 60000)
}

/**
 * Convert a UTC date to local time in the given timezone, returning the local date components.
 */
export function getLocalDateParts(timezone: string, utcDate: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  
  const parts = formatter.formatToParts(utcDate)
  const partMap: Record<string, string> = {}
  parts.forEach(p => { partMap[p.type] = p.value })
  
  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10) - 1,
    day: parseInt(partMap.day, 10),
    hour: parseInt(partMap.hour, 10),
    minute: parseInt(partMap.minute, 10),
  }
}

/**
 * Convert local date/time components in a timezone to a UTC Date.
 */
export function localToUTC(timezone: string, year: number, month: number, day: number, hour: number, minute: number): Date {
  // Find the UTC instant whose rendering in `timezone` equals the given local wall-clock.
  // The offset depends on the UTC instant itself (DST), so iterate to a fixed point.
  // Treat the local wall-clock as a first guess for UTC, then correct.
  let wallMs = Date.UTC(year, month, day, hour, minute)
  let utc = wallMs
  for (let i = 0; i < 4; i++) {
    const offset = getTimezoneOffsetMinutes(timezone, new Date(utc))
    const next = wallMs - offset * 60000
    if (next === utc) break
    utc = next
  }
  return new Date(utc)
}

/**
 * Format a date for display in the visitor's timezone.
 */
export function formatLocalTime(timezone: string, utcDate: Date, opts?: { includeDate?: boolean }): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    ...(opts?.includeDate ? { month: 'short', day: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(utcDate)
}

/**
 * Format a date for the .ics file (UTC).
 */
export function formatICSTime(date: Date): string {
  const d = new Date(date)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

/**
 * Check if a date falls on a given weekday (0 = Sunday, 6 = Saturday).
 */
export function getWeekday(date: Date): number {
  return date.getUTCDay()
}

/**
 * Add minutes to a date.
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

/**
 * Format date as YYYY-MM-DD in the given timezone.
 */
export function formatLocalDate(timezone: string, utcDate: Date): string {
  const parts = getLocalDateParts(timezone, utcDate)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}`
}

/**
 * Compare two dates for equality (same day in the given timezone).
 */
export function isSameDay(timezone: string, a: Date, b: Date): boolean {
  const pa = getLocalDateParts(timezone, a)
  const pb = getLocalDateParts(timezone, b)
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day
}
