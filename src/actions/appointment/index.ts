'use server'

import { client } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'
import { requireDomainAccess } from '@/lib/auth'
import { logger } from '@/lib/logger'

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export const onDomainCustomerResponses = async (customerId: string): Promise<ActionResult> => {
  try {
    const customer = await client.customer.findUnique({
      where: { id: customerId },
      select: { email: true, questions: { select: { id: true, question: true, answered: true } } },
    })
    return { ok: true, data: customer }
  } catch (error) {
    logger.error('onDomainCustomerResponses failed', { error: String(error), customerId })
    return { ok: false, error: 'Failed to load responses', status: 500 }
  }
}

export const onGetAllDomainBookings = async (domainId: string): Promise<ActionResult> => {
  const access = await requireDomainAccess(domainId)
  if ('ok' in access && !access.ok) return { ok: false, error: access.error, status: access.status ?? 403 }
  try {
    const bookings = await client.booking.findMany({
      where: { domainId },
      select: { startsAt: true, endsAt: true },
    })
    return { ok: true, data: bookings.map((b) => ({ slot: b.startsAt.toISOString(), date: b.startsAt })) }
  } catch (error) {
    logger.error('onGetAllDomainBookings failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to load bookings', status: 500 }
  }
}

export const onBookChatBotAppointment = async ({
  domainId,
  customerEmail,
  customerName,
  slot,
  date,
}: {
  domainId: string
  customerEmail: string
  customerName?: string
  slot: string
  date: string
}): Promise<ActionResult> => {
  try {
    const startsAt = new Date(`${date} ${slot}`)
    const safeStart = Number.isNaN(startsAt.getTime()) ? new Date() : startsAt
    const endsAt = new Date(safeStart.getTime() + 30 * 60 * 1000)
    let customer = await client.customer.findFirst({ where: { domainId, email: customerEmail } })
    if (!customer) {
      customer = await client.customer.create({ data: { domainId, email: customerEmail, name: customerName } })
    }
    const booking = await client.booking.create({
      data: { domainId, customerId: customer.id, email: customerEmail, name: customerName, startsAt: safeStart, endsAt, status: 'CONFIRMED' },
    })
    return { ok: true, data: { status: 200, message: 'Booking confirmed', bookingId: booking.id, customerId: customer.id } }
  } catch (error) {
    logger.error('onBookChatBotAppointment failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to book appointment', status: 500 }
  }
}

export const onBookNewAppointment = async (
  domainId: string,
  customerId: string,
  slot: string,
  date: string,
  email: string
): Promise<ActionResult> => {
  try {
    const startsAt = new Date(`${date} ${slot}`)
    const safeStart = Number.isNaN(startsAt.getTime()) ? new Date() : startsAt
    const endsAt = new Date(safeStart.getTime() + 30 * 60 * 1000)
    await client.booking.create({
      data: { domainId, customerId, email, startsAt: safeStart, endsAt, status: 'CONFIRMED' },
    })
    return { ok: true, data: { status: 200, message: 'Booking created' } }
  } catch (error) {
    logger.error('onBookNewAppointment failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to create booking', status: 500 }
  }
}

export const saveAnswers = async (questions: Record<string, string>, customerId: string): Promise<ActionResult> => {
  try {
    const customer = await client.customer.findUnique({ where: { id: customerId }, select: { domainId: true } })
    if (customer) {
      const access = await requireDomainAccess(customer.domainId)
      if ('ok' in access && !access.ok) return { ok: false, error: access.error, status: access.status ?? 403 }
    }
    for (const [question, answered] of Object.entries(questions || {})) {
      await client.customerResponses.create({ data: { customerId, question, answered } })
    }
    return { ok: true, data: { messege: 'Updated Responses' } }
  } catch (error) {
    logger.error('saveAnswers failed', { error: String(error), customerId })
    return { ok: false, error: 'Failed to save answers', status: 500 }
  }
}

export const onGetAllBookingsForCurrentUser = async (clerkId: string) => {
  try {
    const bookings = await client.booking.findMany({
      where: { domain: { members: { some: { user: { clerkId } } } } },
      select: {
        id: true,
        createdAt: true,
        startsAt: true,
        email: true,
        domainId: true,
        customer: { select: { domain: { select: { name: true } } } },
      },
      orderBy: { startsAt: 'asc' },
    })
    return {
      bookings: bookings.map((b) => ({
        id: b.id,
        slot: b.startsAt.toLocaleTimeString(),
        createdAt: b.createdAt,
        date: b.startsAt,
        email: b.email ?? '',
        domainId: b.domainId,
        Customer: { Domain: { name: b.customer?.domain?.name ?? '' } },
      })),
    }
  } catch (error) {
    logger.error('onGetAllBookingsForCurrentUser failed', { error: String(error), clerkId })
  }
}

export const getUserAppointments = async () => {
  try {
    const user = await currentUser()
    if (!user) return 0
    return await client.booking.count({
      where: { domain: { members: { some: { user: { clerkId: user.id } } } } },
    })
  } catch (error) {
    logger.error('getUserAppointments failed', { error: String(error) })
  }
}
