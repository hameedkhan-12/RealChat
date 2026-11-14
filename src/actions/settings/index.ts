'use server'

import { client } from '@/lib/prisma'
import { clerkClient, currentUser } from '@clerk/nextjs/server'
import { requireDomainAccess } from '@/lib/auth'
import { action } from '@/lib/action'
import { logger } from '@/lib/logger'
import { csvRow } from '@/lib/csv'
import { EmailSchema } from '@/lib/validation'
import { hashToken } from '@/lib/session'
import crypto from 'crypto'

const generatePublicKey = () => crypto.randomBytes(18).toString('hex')

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export const onIntegrateDomain = async (
  domain: string,
  icon: string,
  allowedOrigins?: string[],
  timezone?: string
): Promise<ActionResult> => {
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
        allowedOrigins: allowedOrigins ?? [],
        timezone: timezone ?? 'UTC',
        members: { create: { userId: dbUser.id, role: 'OWNER' } },
        chatBot: { create: { welcomeMessage: 'Hi! How can we help you today?' } },
        flowSteps: {
          create: [
            { position: 1, key: 'buy_or_rent', type: 'CHOICE', prompt: 'Are you looking to buy or rent a property?', options: [{ label: 'Buy', value: 'buy', nextStepKey: 'property_type' }, { label: 'Rent', value: 'rent', nextStepKey: 'property_type' }], required: true, mapsTo: 'NONE', isActive: true },
            { position: 2, key: 'property_type', type: 'CHOICE', prompt: 'What type of property interests you?', options: [{ label: 'Apartment', value: 'apartment' }, { label: 'House', value: 'house' }, { label: 'Villa', value: 'villa' }, { label: 'Office', value: 'office' }], required: true, mapsTo: 'NONE', isActive: true },
            { position: 3, key: 'budget', type: 'TEXT', prompt: 'What is your budget range?', options: [], required: true, mapsTo: 'NONE', isActive: true },
            { position: 4, key: 'name', type: 'TEXT', prompt: "May I have your name, please?", options: [], required: true, mapsTo: 'NAME', isActive: true },
            { position: 5, key: 'email', type: 'EMAIL', prompt: 'What is your email address?', options: [], required: true, mapsTo: 'EMAIL', isActive: true },
            { position: 6, key: 'phone', type: 'PHONE', prompt: 'What is your phone number?', options: [], required: true, mapsTo: 'PHONE', isActive: true },
          ],
        },
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
    const slug = domain
    const domainRecord = await client.domain.findFirst({
      where: {
        OR: [{ name: slug }, { name: { startsWith: `${slug}.` } }],
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
  await requireDomainAccess(id)
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
  await requireDomainAccess(domainId)
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
  await requireDomainAccess(domainId)
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
  await requireDomainAccess(id, 'OWNER')
  try {
    const deleted = await client.domain.delete({ where: { id }, select: { name: true } })
    return { ok: true, data: { message: `${deleted.name} was deleted successfully` } }
  } catch (error) {
    logger.error('onDeleteUserDomain failed', { error: String(error) })
    return { ok: false, error: 'Could not delete domain', status: 500 }
  }
}

export const onCreateHelpDeskQuestion = async (id: string, question: string, answer: string): Promise<ActionResult> => {
  await requireDomainAccess(id)
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
  await requireDomainAccess(id)
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
  await requireDomainAccess(id)
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
  await requireDomainAccess(id)
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

/* ============ TEAM / DOMAIN MEMBERS ============ */

export const onGetDomainMembers = async (domainId: string): Promise<ActionResult> => {
  await requireDomainAccess(domainId)
  try {
    const members = await client.domainMember.findMany({
      where: { domainId },
      include: { user: { select: { id: true, fullname: true, clerkId: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return { ok: true, data: { members: members.map((m) => ({ id: m.id, role: m.role, userId: m.userId, fullname: m.user.fullname, clerkId: m.user.clerkId })) } }
  } catch (error) {
    logger.error('onGetDomainMembers failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to load members', status: 500 }
  }
}

export const onInviteAgent = async (domainId: string, email: string): Promise<ActionResult> => {
  return action(async () => {
    await requireDomainAccess(domainId, 'OWNER')
    const emailInput = EmailSchema.parse(email)
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const invite = await client.domainInvite.create({
      data: { domainId, email: emailInput, role: 'AGENT', tokenHash, expiresAt },
      select: { id: true, email: true, expiresAt: true },
    })
    return { ok: true, data: { invite, token } }
  })
}

export const onRemoveTeamMember = async (domainId: string, memberId: string): Promise<ActionResult> => {
  await requireDomainAccess(domainId, 'OWNER')
  try {
    const membership = await client.domainMember.findFirst({ where: { id: memberId, domainId } })
    if (!membership) return { ok: false, error: 'FORBIDDEN', status: 403 }
    await client.domainMember.delete({ where: { id: memberId } })
    return { ok: true, data: { message: 'Member removed' } }
  } catch (error) {
    logger.error('onRemoveTeamMember failed', { error: String(error), domainId, memberId })
    return { ok: false, error: 'Failed to remove member', status: 500 }
  }
}

/* ============ AVAILABILITY ============ */

export const onGetAvailability = async (domainId: string): Promise<ActionResult> => {
  await requireDomainAccess(domainId)
  try {
    const rules = await client.availabilityRule.findMany({ where: { domainId }, orderBy: { weekday: 'asc' } })
    const exceptions = await client.availabilityException.findMany({ where: { domainId }, orderBy: { date: 'asc' } })
    const settings = await client.domain.findUnique({ where: { id: domainId }, select: { slotMinutes: true, bufferMinutes: true, minNoticeHours: true, maxDaysAhead: true, timezone: true } })
    return { ok: true, data: { rules, exceptions, settings } }
  } catch (error) {
    logger.error('onGetAvailability failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to load availability', status: 500 }
  }
}

export const onSetAvailabilityRule = async (domainId: string, weekday: number, startMinute: number, endMinute: number): Promise<ActionResult> => {
  await requireDomainAccess(domainId)
  try {
    const existing = await client.availabilityRule.findFirst({ where: { domainId, weekday } })
    let rule
    if (existing) {
      rule = await client.availabilityRule.update({ where: { id: existing.id }, data: { startMinute, endMinute } })
    } else {
      rule = await client.availabilityRule.create({ data: { domainId, weekday, startMinute, endMinute } })
    }
    return { ok: true, data: { rule } }
  } catch (error) {
    logger.error('onSetAvailabilityRule failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to save availability rule', status: 500 }
  }
}

export const onDeleteAvailabilityRule = async (domainId: string, weekday: number): Promise<ActionResult> => {
  await requireDomainAccess(domainId)
  try {
    const existing = await client.availabilityRule.findFirst({ where: { domainId, weekday } })
    if (existing) await client.availabilityRule.delete({ where: { id: existing.id } })
    return { ok: true, data: { message: 'Rule deleted' } }
  } catch (error) {
    logger.error('onDeleteAvailabilityRule failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to delete rule', status: 500 }
  }
}

export const onSetAvailabilityException = async (domainId: string, date: string, closed: boolean): Promise<ActionResult> => {
  await requireDomainAccess(domainId)
  try {
    const d = new Date(date)
    const existing = await client.availabilityException.findFirst({ where: { domainId, date: d } })
    let exception
    if (existing) {
      exception = await client.availabilityException.update({ where: { id: existing.id }, data: { closed } })
    } else {
      exception = await client.availabilityException.create({ data: { domainId, date: d, closed } })
    }
    return { ok: true, data: { exception } }
  } catch (error) {
    logger.error('onSetAvailabilityException failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to set exception', status: 500 }
  }
}

/* ============ LEADS ============ */

export const onGetLeads = async (domainId: string): Promise<ActionResult> => {
  await requireDomainAccess(domainId)
  try {
    const customers = await client.customer.findMany({
      where: { domainId },
      select: { id: true, email: true, name: true, phone: true, consentAt: true, createdAt: true, questions: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return { ok: true, data: { leads: customers } }
  } catch (error) {
    logger.error('onGetLeads failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to load leads', status: 500 }
  }
}

export const onDeleteLead = async (domainId: string, customerId: string): Promise<ActionResult> => {
  await requireDomainAccess(domainId)
  try {
    const customer = await client.customer.findUnique({ where: { id: customerId } })
    if (!customer || customer.domainId !== domainId) return { ok: false, error: 'Lead not found', status: 404 }
    await client.$transaction([
      client.chatMessage.deleteMany({ where: { chatRoom: { customerId } } }),
      client.chatRoom.deleteMany({ where: { customerId } }),
      client.customerResponses.deleteMany({ where: { customerId } }),
      client.customer.delete({ where: { id: customerId } }),
    ])
    return { ok: true, data: { message: 'Lead deleted' } }
  } catch (error) {
    logger.error('onDeleteLead failed', { error: String(error), domainId, customerId })
    return { ok: false, error: 'Failed to delete lead', status: 500 }
  }
}

export const onExportLeadsCSV = async (domainId: string): Promise<ActionResult> => {
  await requireDomainAccess(domainId)
  try {
    const customers = await client.customer.findMany({
      where: { domainId },
      select: { id: true, email: true, name: true, phone: true, consentAt: true, createdAt: true, questions: { orderBy: { createdAt: 'asc' } } },
    })
    const lines = [csvRow(['id', 'name', 'email', 'phone', 'consentAt', 'createdAt', 'questions'])]
    for (const c of customers) {
      const q = c.questions.map((q) => `${q.question}=${q.answered ?? ''}`).join('; ')
      lines.push(csvRow([c.id, c.name ?? '', c.email ?? '', c.phone ?? '', c.consentAt ?? '', c.createdAt, q]))
    }
    const csv = lines.join('\n')
    return { ok: true, data: { csv, filename: `leads-${domainId}.csv` } }
  } catch (error) {
    logger.error('onExportLeadsCSV failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to export leads', status: 500 }
  }
}

/* ============ EMBED ============ */

export const onGetEmbedConfig = async (domainId: string): Promise<ActionResult> => {
  await requireDomainAccess(domainId)
  try {
    const domain = await client.domain.findUnique({ where: { id: domainId }, select: { id: true, publicKey: true, allowedOrigins: true, name: true } })
    if (!domain) return { ok: false, error: 'Domain not found', status: 404 }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const embedScript = `<script data-key="${domain.publicKey}" data-app-url="${appUrl}" data-position="bottom-right" src="${appUrl}/embed.js"></script>`
    return { ok: true, data: { publicKey: domain.publicKey, allowedOrigins: domain.allowedOrigins, embedScript, chatbotUrl: `${appUrl}/chatbot?key=${domain.publicKey}` } }
  } catch (error) {
    logger.error('onGetEmbedConfig failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to get embed config', status: 500 }
  }
}

export const onUpdateDomainSettings = async (domainId: string, allowedOrigins?: string[], timezone?: string): Promise<ActionResult> => {
  await requireDomainAccess(domainId, 'OWNER')
  try {
    const domain = await client.domain.update({
      where: { id: domainId },
      data: { ...(allowedOrigins !== undefined && { allowedOrigins }), ...(timezone !== undefined && { timezone }) },
    })
    return { ok: true, data: { domain } }
  } catch (error) {
    logger.error('onUpdateDomainSettings failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to update domain settings', status: 500 }
  }
}

/* ============ FLOW STEPS ============ */

export const onGetFlowSteps = async (domainId: string): Promise<ActionResult> => {
  await requireDomainAccess(domainId)
  try {
    const steps = await client.flowStep.findMany({
      where: { domainId, isActive: true },
      orderBy: { position: 'asc' },
    })
    return { ok: true, data: { steps } }
  } catch (error) {
    logger.error('onGetFlowSteps failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to load flow steps', status: 500 }
  }
}

export const onUpsertFlowStep = async (
  domainId: string,
  stepId: string | null,
  input: { position: number; key: string; type: string; prompt: string; options: any; required: boolean; mapsTo: string; isActive: boolean }
): Promise<ActionResult> => {
  await requireDomainAccess(domainId, 'OWNER')
  try {
    if (stepId) {
      const step = await client.flowStep.findFirst({ where: { id: stepId, domainId } })
      if (!step) return { ok: false, error: 'FORBIDDEN', status: 403 }
      const updated = await client.flowStep.update({
        where: { id: stepId },
        data: { position: input.position, key: input.key, type: input.type as any, prompt: input.prompt, options: input.options, required: input.required, mapsTo: input.mapsTo as any, isActive: input.isActive },
      })
      return { ok: true, data: { step: updated } }
    } else {
      const step = await client.flowStep.create({
        data: { domainId, position: input.position, key: input.key, type: input.type as any, prompt: input.prompt, options: input.options, required: input.required, mapsTo: input.mapsTo as any, isActive: input.isActive },
      })
      return { ok: true, data: { step } }
    }
  } catch (error) {
    logger.error('onUpsertFlowStep failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to save flow step', status: 500 }
  }
}

export const onDeleteFlowStep = async (domainId: string, stepId: string): Promise<ActionResult> => {
  await requireDomainAccess(domainId, 'OWNER')
  try {
    const step = await client.flowStep.findFirst({ where: { id: stepId, domainId } })
    if (!step) return { ok: false, error: 'FORBIDDEN', status: 403 }
    await client.flowStep.delete({ where: { id: stepId } })
    return { ok: true, data: { message: 'Flow step deleted' } }
  } catch (error) {
    logger.error('onDeleteFlowStep failed', { error: String(error), domainId, stepId })
    return { ok: false, error: 'Failed to delete flow step', status: 500 }
  }
}


