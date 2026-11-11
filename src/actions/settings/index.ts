'use server'

import { client } from '@/lib/prisma'
import { clerkClient, currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'

const generatePublicKey = () => crypto.randomBytes(18).toString('hex')

export const onIntegrateDomain = async (domain: string, icon: string) => {
  const user = await currentUser()
  if (!user) return
  try {
    const dbUser = await client.user.findUnique({ where: { clerkId: user.id }, select: { id: true } })
    if (!dbUser) return { status: 400, message: 'User not found' }

    const domainExists = await client.domain.findFirst({
      where: { name: domain, members: { some: { userId: dbUser.id } } },
    })
    if (domainExists) return { status: 400, message: 'Domain already exists' }

    const newDomain = await client.domain.create({
      data: {
        name: domain,
        icon,
        publicKey: generatePublicKey(),
        members: { create: { userId: dbUser.id, role: 'OWNER' } },
        chatBot: { create: { welcomeMessage: 'Hi! How can we help you today?' } },
      },
    })
    if (newDomain) return { status: 200, message: 'Domain successfully added', domain: newDomain }
    return { status: 400, message: 'Could not create domain' }
  } catch (error) {
    console.log(error)
  }
}

export const onGetSubscriptionPlan = async () => null

export const onGetAllAccountDomains = async () => {
  const user = await currentUser()
  if (!user) return
  try {
    const dbUser = await client.user.findUnique({
      where: { clerkId: user.id },
      select: {
        id: true,
        memberships: {
          select: {
            domain: {
              select: {
                name: true,
                icon: true,
                id: true,
                customers: {
                  select: { chatRooms: { select: { id: true, status: true } } },
                },
              },
            },
          },
        },
      },
    })
    if (!dbUser) return { id: undefined, domains: [] }
    const domains = dbUser.memberships.map((m) => ({
      name: m.domain.name,
      icon: m.domain.icon ?? '',
      id: m.domain.id,
      customer: m.domain.customers.map((c) => ({
        chatRoom: c.chatRooms.map((r) => ({ id: r.id, live: r.status === 'LIVE' })),
      })),
    }))
    return { id: dbUser.id, domains }
  } catch (error) {
    console.log(error)
  }
}

export const onUpdatePassword = async (password: string) => {
  try {
    const user = await currentUser()
    if (!user) return null
    const clerk = await clerkClient()
    await clerk.users.updateUser(user.id, { password })
    return { status: 200, message: 'Password updated' }
  } catch (error) {
    console.log(error)
  }
}

export const onGetCurrentDomainInfo = async (domain: string) => {
  const user = await currentUser()
  if (!user) return
  try {
    const dbUser = await client.user.findUnique({ where: { clerkId: user.id }, select: { id: true } })
    if (!dbUser) return
    const domainRecord = await client.domain.findFirst({
      where: {
        name: domain,
        members: { some: { userId: dbUser.id } },
      },
      include: {
        chatBot: true,
        helpdesk: true,
        filterQuestions: true,
        members: { include: { user: true } },
      },
    })
    if (!domainRecord) return
    // Legacy shape adapter for existing dashboard components
    const chatBot = domainRecord.chatBot
      ? {
          ...domainRecord.chatBot,
          icon: domainRecord.chatBot.avatarUrl,
          background: domainRecord.chatBot.primaryColor,
        }
      : null
    return {
      subscription: { plan: 'STANDARD' as const },
      domains: [{ ...domainRecord, userId: dbUser.id, products: [], chatBot }],
    }
  } catch (error) {
    console.log(error)
  }
}

export const onUpdateDomain = async (id: string, name: string) => {
  try {
    const domain = await client.domain.update({ where: { id }, data: { name } })
    if (domain) return { status: 200, message: 'Domain updated' }
    return { status: 400, message: 'Oops something went wrong!' }
  } catch (error) {
    console.log(error)
    return { status: 400, message: 'Could not update domain' }
  }
}

export const onChatBotImageUpdate = async (id: string, icon: string) => {
  try {
    const domain = await client.domain.update({
      where: { id },
      data: { chatBot: { upsert: { create: { avatarUrl: icon }, update: { avatarUrl: icon } } } },
    })
    if (domain) return { status: 200, message: 'Chatbot updated' }
    return { status: 400, message: 'Oops something went wrong!' }
  } catch (error) {
    console.log(error)
  }
}

export const onUpdateWelcomeMessage = async (message: string, domainId: string) => {
  try {
    await client.domain.update({
      where: { id: domainId },
      data: { chatBot: { upsert: { create: { welcomeMessage: message }, update: { welcomeMessage: message } } } },
    })
    return { status: 200, message: 'Welcome message updated' }
  } catch (error) {
    console.log(error)
  }
}

export const onUpdateChatBotTheme = async (domainId: string, background?: string, textColor?: string) => {
  try {
    await client.domain.update({
      where: { id: domainId },
      data: {
        chatBot: {
          upsert: {
            create: { primaryColor: background, textColor },
            update: {
              ...(background !== undefined && { primaryColor: background }),
              ...(textColor !== undefined && { textColor }),
            },
          },
        },
      },
    })
    return { status: 200, message: 'Chatbot customization updated' }
  } catch (error) {
    console.log(error)
  }
}

export const onDeleteUserDomain = async (id: string) => {
  const user = await currentUser()
  if (!user) return
  try {
    const dbUser = await client.user.findUnique({ where: { clerkId: user.id }, select: { id: true } })
    if (!dbUser) return
    const membership = await client.domainMember.findFirst({ where: { domainId: id, userId: dbUser.id, role: 'OWNER' } })
    if (!membership) return { status: 403, message: 'Not authorized' }
    const deleted = await client.domain.delete({ where: { id }, select: { name: true } })
    return { status: 200, message: `${deleted.name} was deleted successfully` }
  } catch (error) {
    console.log(error)
  }
}

export const onCreateHelpDeskQuestion = async (id: string, question: string, answer: string) => {
  try {
    await client.helpDesk.create({ data: { domainId: id, question, answer } })
    const questions = await client.helpDesk.findMany({ where: { domainId: id }, select: { id: true, question: true, answer: true } })
    return { status: 200, message: 'New help desk question added', questions }
  } catch (error) {
    console.log(error)
    return { status: 400, message: 'Oops! something went wrong' }
  }
}

export const onGetAllHelpDeskQuestions = async (id: string) => {
  try {
    const questions = await client.helpDesk.findMany({
      where: { domainId: id },
      select: { question: true, answer: true, id: true },
    })
    return { status: 200, message: '', questions }
  } catch (error) {
    console.log(error)
  }
}

export const onCreateFilterQuestions = async (id: string, question: string) => {
  try {
    await client.filterQuestions.create({ data: { domainId: id, question } })
    const questions = await client.filterQuestions.findMany({ where: { domainId: id }, select: { id: true, question: true } })
    return { status: 200, message: 'Filter question added', questions }
  } catch (error) {
    console.log(error)
    return { status: 400, message: 'Oops! something went wrong' }
  }
}

export const onGetAllFilterQuestions = async (id: string) => {
  try {
    const questions = await client.filterQuestions.findMany({
      where: { domainId: id },
      select: { question: true, id: true },
      orderBy: { question: 'asc' },
    })
    return { status: 200, message: '', questions }
  } catch (error) {
    console.log(error)
  }
}

export const onGetPaymentConnected = async () => null

export const onCreateNewDomainProduct = async (
  id: string,
  name: string,
  image: string,
  price: string
) => {
  // Products removed in Phase 1 schema; placeholder for compatibility
  void id; void name; void image; void price
  return { status: 200, message: 'Not available' }
}