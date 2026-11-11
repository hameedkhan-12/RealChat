'use server'

import { client } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

export const onDomainCustomerResponses = async (customerId: string) => {
  try {
    const customerQuestions = await client.customer.findUnique({
      where: {
        id: customerId,
      },
      select: {
        email: true,
        questions: {
          select: {
            id: true,
            question: true,
            answered: true,
          },
        },
      },
    })

    if (customerQuestions) {
      return customerQuestions
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetAllDomainBookings = async (domainId: string) => {
  try {
    const bookings = await client.bookings.findMany({
      where: {
        domainId,
      },
      select: {
        slot: true,
        date: true,
      },
    })

    if (bookings) {
      return bookings
    }
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
    let customer = await client.customer.findFirst({
      where: {
        domainId,
        email: customerEmail,
      },
      include: {
        chatRoom: true,
      },
    })

    if (!customer) {
      customer = await client.customer.create({
        data: {
          email: customerEmail,
          domainId,
          chatRoom: {
            create: {},
          },
        },
        include: {
          chatRoom: true,
        },
      })
    }

    const parsedDate = new Date(date)
    const booking = await client.bookings.create({
      data: {
        date: parsedDate,
        slot,
        email: customerEmail,
        domainId,
        customerId: customer.id,
      },
    })

    if (customer.chatRoom?.[0]?.id) {
      await client.chatMessage.create({
        data: {
          chatRoomId: customer.chatRoom[0].id,
          role: 'assistant',
          message: `📅 Meeting Booked: Discovery Intro Call on ${slot}, ${date}. Contact: ${customerName || customerEmail} (${customerEmail}).`,
        },
      })
    }

    return {
      status: 200,
      message: 'Booking successfully confirmed',
      bookingId: booking.id,
      customerId: customer.id,
      chatRoomId: customer.chatRoom?.[0]?.id,
    }
  } catch (error) {
    console.error('Error booking appointment from chatbot:', error)
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
    const booking = await client.customer.update({
      where: {
        id: customerId,
      },
      data: {
        booking: {
          create: {
            domainId,
            slot,
            date,
            email,
          },
        },
      },
    })

    if (booking) {
      return { status: 200, message: 'Booking created' }
    }
  } catch (error) {
    console.log(error)
  }
}

export const saveAnswers = async (
  questions: [question: string],
  customerId: string
) => {
  try {
    for (const question in questions) {
      await client.customer.update({
        where: { id: customerId },
        data: {
          questions: {
            update: {
              where: {
                id: question,
              },
              data: {
                answered: questions[question],
              },
            },
          },
        },
      })
    }
    return {
      status: 200,
      messege: 'Updated Responses',
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetAllBookingsForCurrentUser = async (clerkId: string) => {
  try {
    const bookings = await client.bookings.findMany({
      where: {
        Customer: {
          Domain: {
            User: {
              clerkId,
            },
          },
        },
      },
      select: {
        id: true,
        slot: true,
        createdAt: true,
        date: true,
        email: true,
        domainId: true,
        Customer: {
          select: {
            Domain: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (bookings) {
      return {
        bookings,
      }
    }
  } catch (error) {
    console.log(error)
  }
}

export const getUserAppointments = async () => {
  try {
    const user = await currentUser()
    if (user) {
      const bookings = await client.bookings.count({
        where: {
          Customer: {
            Domain: {
              User: {
                clerkId: user.id,
              },
            },
          },
        },
      })

      if (bookings) {
        return bookings
      }
    }
  } catch (error) {
    console.log(error)
  }
}
