'use server'

import { client } from '@/lib/prisma'
import { clerkClient, currentUser } from '@clerk/nextjs/server'
import { requireDomainAccess } from '@/lib/auth'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

const generatePublicKey = () => crypto.randomBytes(18).toString('hex')

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export const onIntegrateDomain = async (domain: string, icon: string): Promise<ActionResult> => {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'UNAUTHORIZED', status: 401 }
  try {
    const dbUser = await client.user.findUnique({ where: { clerkId: user.id }, select: { id: true } })
    if (!dbUser) return { ok: false, error: 'User not found', status: 400 }

    const domainExists = await client.domain.findFirst({
      where: { name: domain, members: { some: { userId: dbUser.id } } },
    })
    if (domainExists) return { ok: false, error: 'Domain already exists', status: 400 }

    const newDomain = await client.domain.create({
      data: {
        name: domain,
        icon,
        publicKey: generatePublicKey(),
        members: { create: { userId: dbUser.id, role: 'OWNER' } },
        chatBot: { create: { welcomeMessage: 'Hi! How can we help you today?' } },
      },
    })
    if (newDomain) return { ok: true, data: { message: 'Domain successfully added', domain: newDomain } }
    return { ok: false, error: 'Could not create domain', status: 400 }
  } catch (error) {
    logger.error('onIntegrateDomain failed', { error: String(error) })
    return { ok: false, error: 'Failed to create domain', status: 500 }
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
                publicKey: true,
                timezone: true,
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
      publicKey: m.domain.publicKey,
      timezone: m.domain.timezone,
      customer: m.domain.customers.map((c) => ({
        chatRoom: c.chatRooms.map((r) => ({ id: r.id, live: r.status === 'LIVE' })),
      })),
    }))
    return { id: dbUser.id, domains }
  } catch (error) {
    logger.error('onGetAllAccountDomains failed', { error: String(error) })
  }
}

export const onUpdatePassword = async (password: string) => {
  try {
    const user = await currentUser()
    if (!user) return null
    const clerk = await clerkClient()
    await clerk.users.updateUser(user.id, { password })
    return { ok: true, data: { message: 'Password updated' } }
  } catch (error) {
    logger.error('onUpdatePassword failed', { error: String(error) })
    return null
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
    logger.error('onGetCurrentDomainInfo failed', { error: String(error) })
  }
}

export const onUpdateDomain = async (id: string, name: string): Promise<ActionResult> => {
  await requireDomainAccess(id, 'OWNER')
  try {
    const domain = await client.domain.update({ where: { id }, data: { name } })
    if (domain) return { ok: true, data: { message: 'Domain updated' } }
    return { ok: false, error: 'Domain not found', status: 404 }
  } catch (error) {
    logger.error('onUpdateDomain failed', { error: String(error) })
    return { ok: false, error: 'Could not update domain', status: 500 }
  }
}

export const onChatBotImageUpdate = async (id: string, icon: string): Promise<ActionResult> => {
  const access = await requireDomainAccess(id)
  if ('ok' in access && !access.ok) return { ok: false, error: access.error, status: 403 }
  try {
    const domain = await client.domain.update({
      where: { id },
      data: { chatBot: { upsert: { create: { avatarUrl: icon }, update: { avatarUrl: icon } } } },
    })
    if (domain) return { ok: true, data: { message: 'Chatbot updated' } }
    return { ok: false, error: 'Domain not found', status: 404 }
  } catch (error) {
    logger.error('onChatBotImageUpdate failed', { error: String(error) })
    return { ok: false, error: 'Could not update chatbot', status: 500 }
  }
}

export const onUpdateWelcomeMessage = async (message: string, domainId: string): Promise<ActionResult> => {
  const access = await requireDomainAccess(domainId)
  if ('ok' in access && !access.ok) return { ok: false, error: access.error, status: 403 }
  try {
    await client.domain.update({
      where: { id: domainId },
      data: { chatBot: { upsert: { create: { welcomeMessage: message }, update: { welcomeMessage: message } } } },
    })
    return { ok: true, data: { message: 'Welcome message updated' } }
  } catch (error) {
    logger.error('onUpdateWelcomeMessage failed', { error: String(error) })
    return { ok: false, error: 'Failed to update welcome message', status: 500 }
  }
}

export const onUpdateChatBotTheme = async (domainId: string, background?: string, textColor?: string): Promise<ActionResult> => {
  const access = await requireDomainAccess(domainId)
  if ('ok' in access && !access.ok) return { ok: false, error: access.error, status: 403 }
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
    return { ok: true, data: { message: 'Chatbot customization updated' } }
  } catch (error) {
    logger.error('onUpdateChatBotTheme failed', { error: String(error) })
    return { ok: false, error: 'Could not update chatbot theme', status: 500 }
  }
}

export const onDeleteUserDomain = async (id: string): Promise<ActionResult> => {
  const access = await requireDomainAccess(id, 'OWNER')
  if ('ok' in access && !access.ok) return { ok: false, error: access.error, status: 403 }
  try {
    const deleted = await client.domain.delete({ where: { id }, select: { name: true } })
    return { ok: true, data: { message: `${deleted.name} was deleted successfully` } }
  } catch (error) {
    logger.error('onDeleteUserDomain failed', { error: String(error) })
    return { ok: false, error: 'Could not delete domain', status: 500 }
  }
}

export const onCreateHelpDeskQuestion = async (id: string, question: string, answer: string): Promise<ActionResult> => {
  const access = await requireDomainAccess(id)
  if ('ok' in access && !access.ok) return { ok: false, error: access.error, status: 403 }
  try {
    await client.helpDesk.create({ data: { domainId: id, question, answer } })
    const questions = await client.helpDesk.findMany({ where: { domainId: id }, select: { id: true, question: true, answer: true } })
    return { ok: true, data: { message: 'New help desk question added', questions } }
  } catch (error) {
    logger.error('onCreateHelpDeskQuestion failed', { error: String(error) })
    return { ok: false, error: 'Oops! something went wrong', status: 400 }
  }
}

export const onGetAllHelpDeskQuestions = async (id: string): Promise<ActionResult> => {
  const access = await requireDomainAccess(id)
  if ('ok' in access && !access.ok) return { ok: false, error: access.error, status: 403 }
  try {
    const questions = await client.helpDesk.findMany({
      where: { domainId: id },
      select: { question: true, answer: true, id: true },
    })
    return { ok: true, data: { message: '', questions } }
  } catch (error) {
    logger.error('onGetAllHelpDeskQuestions failed', { error: String(error) })
    return { ok: false, error: 'Oops! something went wrong', status: 400 }
  }
}

export const onCreateFilterQuestions = async (id: string, question: string): Promise<ActionResult> => {
  const access = await requireDomainAccess(id)
  if ('ok' in access && !access.ok) return { ok: false, error: access.error, status: 403 }
  try {
    await client.filterQuestions.create({ data: { domainId: id, question } })
    const questions = await client.filterQuestions.findMany({ where: { domainId: id }, select: { id: true, question: true } })
    return { ok: true, data: { message: 'Filter question added', questions } }
  } catch (error) {
    logger.error('onCreateFilterQuestions failed', { error: String(error) })
    return { ok: false, error: 'Oops! something went wrong', status: 400 }
  }
}

export const onGetAllFilterQuestions = async (id: string): Promise<ActionResult> => {
  const access = await requireDomainAccess(id)
  if ('ok' in access && !access.ok) return { ok: false, error: access.error, status: 403 }
  try {
    const questions = await client.filterQuestions.findMany({
      where: { domainId: id },
      select: { question: true, id: true },
      orderBy: { question: 'asc' },
    })
    return { ok: true, data: { message: '', questions } }
  } catch (error) {
    logger.error('onGetAllFilterQuestions failed', { error: String(error) })
    return { ok: false, error: 'Oops! something went wrong', status: 400 }
  }
}

export const onGetPaymentConnected = async () => null

export const onCreateNewDomainProduct = async (
  id: string,
  name: string,
  image: string,
  price: string
): Promise<ActionResult> => {
  // Products removed in Phase 1 schema; placeholder for compatibility
  void id; void name; void image; void price
  return { ok: true, data: { message: 'Not available' } }
}
