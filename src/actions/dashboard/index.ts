'use server'

import { client } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

export const getUserClients = async () => {
  try {
    const user = await currentUser()
    if (!user) return 0
    return await client.customer.count({
      where: { domain: { members: { some: { user: { clerkId: user.id } } } } },
    })
  } catch (error) {
    console.log(error)
  }
}

export const getUserBalance = async () => 0

export const getUserPlanInfo = async () => {
  try {
    const user = await currentUser()
    if (!user) return
    const dbUser = await client.user.findUnique({
      where: { clerkId: user.id },
      select: { _count: { select: { memberships: true } } },
    })
    return {
      plan: 'STANDARD',
      credits: 0,
      domains: dbUser?._count.memberships ?? 0,
    }
  } catch (error) {
    console.log(error)
  }
}

export const getUserTotalProductPrices = async () => 0

export const getUserTransactions = async () => null