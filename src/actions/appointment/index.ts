'use server'

import { client } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

export const onDomainCustomerResponses = async (customerId: string) => {
  try {
    return await client.customer.findUnique({
      where: { id: customerId },
      select: { email: true, questions: { select: { id: true, question: true, answered: true } } },
    })
  } catch (error) {
    console.log(error)
  }
}

export const onGetAllDomainBookings = async (domainId: string) => {
  try {
    const bookings = await client.booking.findMany({
      where: { domainId },
      select: { startsAt: true, endsAt: true },
    })
    return bookings.map((b) => ({ slot: b.startsAt.toISOString(), date: b.startsAt }))
  } catch (error) {
    console.log(error)
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
}) => {
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
    return { status: 200, message: 'Booking confirmed', bookingId: booking.id, customerId: customer.id }
  } catch (error) {
    console.error('Error booking appointment:', error)
    return { status: 500, message: 'Failed to book appointment' }
  }
}

export const onBookNewAppointment = async (
  domainId: string,
  customerId: string,
  slot: string,
  date: string,
  email: string
) => {
  try {
    const startsAt = new Date(`${date} ${slot}`)
    const safeStart = Number.isNaN(startsAt.getTime()) ? new Date() : startsAt
    const endsAt = new Date(safeStart.getTime() + 30 * 60 * 1000)
    await client.booking.create({
      data: { domainId, customerId, email, startsAt: safeStart, endsAt, status: 'CONFIRMED' },
    })
    return { status: 200, message: 'Booking created' }
  } catch (error) {
    console.log(error)
  }
}

export const saveAnswers = async (questions: Record<string, string>, customerId: string) => {
  try {
    for (const [question, answered] of Object.entries(questions || {})) {
      await client.customerResponses.create({ data: { customerId, question, answered } })
    }
    return { status: 200, messege: 'Updated Responses' }
  } catch (error) {
    console.log(error)
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
    console.log(error)
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
    console.log(error)
  }
}