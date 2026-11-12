'use server'

import { currentUser } from '@clerk/nextjs/server'
import { client } from '@/lib/prisma'

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export type MinRole = 'OWNER' | 'AGENT'
const roleRank: Record<MinRole, number> = { AGENT: 1, OWNER: 2 }

export async function requireUser() {
  const clerk = await currentUser()
  if (!clerk) throw new Error('UNAUTHORIZED')
  const user = await client.user.findUnique({ where: { clerkId: clerk.id } })
  if (!user) throw new Error('UNAUTHORIZED')
  return { clerk, user }
}

export async function requireDomainAccess(domainId: string, minRole: MinRole = 'AGENT') {
  const { user } = await requireUser()
  const membership = await client.domainMember.findUnique({
    where: { domainId_userId: { domainId, userId: user.id } },
  })
  if (!membership) throw new Error('FORBIDDEN')
  if (roleRank[membership.role] < roleRank[minRole]) throw new Error('FORBIDDEN')
  return { user, membership }
}

export async function getDomainIdForResource(
  kind: 'chatRoom' | 'booking' | 'customer' | 'flowStep' | 'helpdesk' | 'filterQuestion',
  id: string
) {
  if (kind === 'chatRoom') return (await client.chatRoom.findUnique({ where: { id }, select: { domainId: true } }))?.domainId ?? null
  if (kind === 'booking') return (await client.booking.findUnique({ where: { id }, select: { domainId: true } }))?.domainId ?? null
  if (kind === 'customer') return (await client.customer.findUnique({ where: { id }, select: { domainId: true } }))?.domainId ?? null
  if (kind === 'flowStep') return (await client.flowStep.findUnique({ where: { id }, select: { domainId: true } }))?.domainId ?? null
  if (kind === 'helpdesk') return (await client.helpDesk.findUnique({ where: { id }, select: { domainId: true } }))?.domainId ?? null
  if (kind === 'filterQuestion') return (await client.filterQuestions.findUnique({ where: { id }, select: { domainId: true } }))?.domainId ?? null
  return null
}

export async function requireResourceAccess(
  kind: Parameters<typeof getDomainIdForResource>[0],
  id: string,
  minRole: MinRole = 'AGENT'
) {
  const domainId = await getDomainIdForResource(kind, id)
  if (!domainId) throw new Error('NOT_FOUND')
  const access = await requireDomainAccess(domainId, minRole)
  return { ...access, domainId }
}
