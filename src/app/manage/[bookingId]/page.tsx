import { client } from '@/lib/prisma'
import { CancelAppointmentForm } from './cancel-appointment-form'

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { bookingId } = await params
  const sp = await searchParams
  const token = typeof sp.token === 'string' ? sp.token : ''

  const booking = await client.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      email: true,
      name: true,
      phone: true,
      startsAt: true,
      endsAt: true,
      visitorTimezone: true,
      cancelledAt: true,
      domain: { select: { name: true, timezone: true } },
    },
  })

  if (!booking) {
    return (
      <html>
        <body>
          <p>Booking not found.</p>
        </body>
      </html>
    )
  }

  const tz = booking.visitorTimezone || booking.domain.timezone || 'UTC'
  const startLabel = booking.startsAt.toLocaleString(undefined, { timeZone: tz })
  const endLabel = booking.endsAt.toLocaleString(undefined, { timeZone: tz })

  const canCancel = booking.status === 'CONFIRMED' && !booking.cancelledAt && !!token

  return (
    <html>
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', lineHeight: 1.5 }}>
        <h1>Manage Appointment</h1>
        <p>
          <strong>Business:</strong> {booking.domain.name}
        </p>
        <p>
          <strong>Customer:</strong> {booking.name || booking.email}
        </p>
        <p>
          <strong>Email:</strong> {booking.email}
        </p>
        {booking.phone && <p><strong>Phone:</strong> {booking.phone}</p>}
        <p>
          <strong>Date:</strong> {startLabel} - {endLabel} {tz ? '(' + tz + ')' : ''}
        </p>
        <p>
          <strong>Status:</strong> {booking.status}
        </p>
        {booking.cancelledAt && <p><strong>Cancelled at:</strong> {new Date(booking.cancelledAt).toLocaleString()}</p>}
        {canCancel ? (
          <CancelAppointmentForm bookingId={booking.id} token={token} />
        ) : token === '' ? (
          <p style={{ marginTop: '1rem', color: '#dc2626' }}>Add <code>?token=MANAGE_TOKEN</code> to this URL to enable cancellation.</p>
        ) : (
          <p style={{ marginTop: '1rem', color: '#666' }}>This appointment cannot be cancelled.</p>
        )}
      </body>
    </html>
    )
  }
