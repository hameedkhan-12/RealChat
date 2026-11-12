import { formatICSTime } from '@/lib/timezone'

export function generateICS({
  bookingId,
  domainName,
  customerName,
  customerEmail,
  startsAt,
  endsAt,
  manageUrl,
}: {
  bookingId: string
  domainName: string
  customerName?: string | null
  customerEmail?: string | null
  startsAt: Date
  endsAt: Date
  manageUrl: string
}): string {
  const startStr = formatICSTime(startsAt)
  const endStr = formatICSTime(endsAt)
  const nowStr = formatICSTime(new Date())
  const uid = `booking-${bookingId}@corinna-ai`
  const summary = `Appointment with ${domainName}`
  const description = customerName
    ? `Appointment with ${customerName} (${customerEmail || 'no email'})`
    : `Appointment with ${customerEmail || 'a visitor'}`
  
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Corinna AI//Booking System//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `URL:${manageUrl}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Appointment starting in 15 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
