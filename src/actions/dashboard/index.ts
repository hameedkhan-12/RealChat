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
