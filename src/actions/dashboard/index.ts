'use server'

import { client } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'
import { requireDomainAccess } from '@/lib/auth'
import { logger } from '@/lib/logger'

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export const getUserClients = async (): Promise<ActionResult> => {
  try {
    const user = await currentUser()
    if (!user) return { ok: false, error: 'UNAUTHORIZED', status: 401 }
    return {
      ok: true,
      data: await client.customer.count({
        where: { domain: { members: { some: { user: { clerkId: user.id } } } } },
      }),
    }
  } catch (error) {
    logger.error('getUserClients failed', { error: String(error) })
    return { ok: false, error: 'Failed to load clients', status: 500 }
  }
}

export const getUserBalance = async (): Promise<ActionResult> => {
  return { ok: true, data: 0 }
}

export const getUserPlanInfo = async (): Promise<ActionResult> => {
  try {
    const user = await currentUser()
    if (!user) return { ok: false, error: 'UNAUTHORIZED', status: 401 }
    const dbUser = await client.user.findUnique({
      where: { clerkId: user.id },
      select: { _count: { select: { memberships: true } } },
    })
    return {
      ok: true,
      data: {
        plan: 'STANDARD',
        credits: 0,
        domains: dbUser?._count.memberships ?? 0,
      },
    }
  } catch (error) {
    logger.error('getUserPlanInfo failed', { error: String(error) })
    return { ok: false, error: 'Failed to load plan info', status: 500 }
  }
}

export const getUserTotalProductPrices = async (): Promise<ActionResult> => {
  return { ok: true, data: 0 }
}

export const getUserTransactions = async (): Promise<ActionResult> => {
  return { ok: true, data: null }
}

/* ============ CONVERSATION STATS ============ */

export const getUserConversationStats = async (): Promise<ActionResult> => {
  try {
    const user = await currentUser()
    if (!user) return { ok: false, error: 'UNAUTHORIZED', status: 401 }

    const dbUser = await client.user.findUnique({
      where: { clerkId: user.id },
      select: { id: true },
    })
    if (!dbUser) return { ok: false, error: 'User not found', status: 404 }

    const memberships = await client.domainMember.findMany({
      where: { userId: dbUser.id },
      select: { domainId: true },
    })
    const domainIds = memberships.map((m) => m.domainId)

    if (domainIds.length === 0) {
      return { ok: true, data: { total: 0, live: 0, waitingAgent: 0, closed: 0, assignedToMe: 0 } }
    }

    const domainWhere = { domainId: { in: domainIds } }

    const [total, live, waitingAgent, closed, assignedToMe] = await Promise.all([
      client.chatRoom.count({ where: domainWhere }),
      client.chatRoom.count({ where: { ...domainWhere, status: 'LIVE' } }),
      client.chatRoom.count({ where: { ...domainWhere, status: 'WAITING_AGENT' } }),
      client.chatRoom.count({ where: { ...domainWhere, status: 'CLOSED' } }),
      client.chatRoom.count({ where: { ...domainWhere, assignedToUserId: dbUser.id } }),
    ])

    return { ok: true, data: { total, live, waitingAgent, closed, assignedToMe } }
  } catch (error) {
    logger.error('getUserConversationStats failed', { error: String(error) })
    return { ok: false, error: 'Failed to load conversation stats', status: 500 }
  }
}
