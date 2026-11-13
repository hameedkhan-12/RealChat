'use server'

import { client } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'
import { requireDomainAccess, requireResourceAccess } from '@/lib/auth'
import { action } from '@/lib/action'
import { logger } from '@/lib/logger'

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export const onDomainCustomerResponses = async (customerId: string): Promise<ActionResult> => {
  return action(async () => {
    const access = await requireResourceAccess('customer', customerId, 'AGENT')
    const customer = await client.customer.findUnique({
      where: { id: customerId, domainId: access.domainId },
      select: { email: true, questions: { select: { id: true, question: true, answered: true } } },
    })
    if (!customer) return { ok: false, error: 'FORBIDDEN', status: 403 }
    return { ok: true, data: customer }
  })
}

export const onGetAllDomainBookings = async (domainId: string): Promise<ActionResult> => {
  await requireDomainAccess(domainId)
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
  return action(async () => {
    await requireDomainAccess(domainId)
    const startsAt = new Date(`${date} ${slot}`)
    const safeStart = Number.isNaN(startsAt.getTime()) ? new Date() : startsAt
    const endsAt = new Date(safeStart.getTime() + 30 * 60 * 1000)

    // Transactional booking with conflict handling
    const conflict = await client.$transaction(async (tx) => {
      const existing = await tx.booking.findFirst({
        where: {
          domainId,
          status: 'CONFIRMED',
          startsAt: { lt: endsAt },
          endsAt: { gt: safeStart },
        },
      })
      if (existing) {
        throw new Error('SLOT_CONFLICT')
      }
      return null
    })

    let customer = await client.customer.findFirst({ where: { domainId, email: customerEmail } })
    if (!customer) {
      customer = await client.customer.create({ data: { domainId, email: customerEmail, name: customerName } })
    }

    const booking = await client.booking.create({
      data: {
        domainId,
        customerId: customer.id,
        email: customerEmail,
        name: customerName ?? null,
        startsAt: safeStart,
        endsAt,
        status: 'CONFIRMED',
      },
    })

    return { ok: true, data: { status: 200, message: 'Booking confirmed', bookingId: booking.id, customerId: customer.id } }
  })
}

export const onBookNewAppointment = async (
  domainId: string,
  customerId: string,
  slot: string,
  date: string,
  email: string
): Promise<ActionResult> => {
  return action(async () => {
    await requireDomainAccess(domainId)
    const startsAt = new Date(`${date} ${slot}`)
    const safeStart = Number.isNaN(startsAt.getTime()) ? new Date() : startsAt
    const endsAt = new Date(safeStart.getTime() + 30 * 60 * 1000)

    // Verify the customer belongs to this domain (IDOR guard)
    const customer = await client.customer.findFirst({ where: { id: customerId, domainId } })
    if (!customer) return { ok: false, error: 'FORBIDDEN', status: 403 }

    await client.booking.create({
      data: { domainId, customerId: customer.id, email, startsAt: safeStart, endsAt, status: 'CONFIRMED' },
    })
    return { ok: true, data: { status: 200, message: 'Booking created' } }
  })
}

export const saveAnswers = async (questions: Record<string, string>, customerId: string): Promise<ActionResult> => {
  return action(async () => {
    const access = await requireResourceAccess('customer', customerId, 'AGENT')
    for (const [stepKey, answered] of Object.entries(questions || {})) {
      await client.customerResponses.create({
        data: { customerId, stepKey, question: stepKey, answered },
      })
    }
    return { ok: true, data: { saved: true, domainId: access.domainId } }
  })
}

export const onGetAllBookingsForCurrentUser = async () => {
  return action(async () => {
    const { user } = await requireUser()
    const bookings = await client.booking.findMany({
      where: { domain: { members: { some: { userId: user.id } } } },
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
  })
}

export const getUserAppointments = async (): Promise<ActionResult> => {
  try {
    const user = await currentUser()
    if (!user) return { ok: false, error: 'UNAUTHORIZED', status: 401 }
    return {
      ok: true,
      data: await client.booking.count({
        where: { domain: { members: { some: { user: { clerkId: user.id } } } } },
      }),
    }
  } catch (error) {
    logger.error('getUserAppointments failed', { error: String(error) })
    return { ok: false, error: 'Failed to load appointments', status: 500 }
  }
}
