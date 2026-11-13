import 'server-only'
import { currentUser } from '@clerk/nextjs/server'
import { client } from '@/lib/prisma'
import { AuthError } from '@/lib/errors'

export { AuthError }
export type MinRole = 'OWNER' | 'AGENT'
const roleRank: Record<MinRole, number> = { AGENT: 1, OWNER: 2 }

/** Returns the signed-in user. Creates the local User row on first sight. */
export async function requireUser() {
  const clerk = await currentUser()
  if (!clerk) throw new AuthError('UNAUTHORIZED')
  let user = await client.user.findUnique({ where: { clerkId: clerk.id } })
  if (!user) {
    const fullname =
      clerk.fullName ?? clerk.firstName ?? clerk.primaryEmailAddress?.emailAddress ?? 'User'
    try {
      user = await client.user.create({ data: { clerkId: clerk.id, fullname, type: 'owner' } })
    } catch {
      user = await client.user.findUnique({ where: { clerkId: clerk.id } }) // lost a race
    }
  }
  if (!user) throw new AuthError('UNAUTHORIZED')
  return { clerk, user }
}

export async function requireDomainAccess(domainId: string, minRole: MinRole = 'AGENT') {
  const { user } = await requireUser()
  const membership = await client.domainMember.findUnique({
    where: { domainId_userId: { domainId, userId: user.id } },
  })
  if (!membership || roleRank[membership.role] < roleRank[minRole]) throw new AuthError('FORBIDDEN')
  return { user, membership }
}

type ResourceKind = 'chatRoom' | 'booking' | 'customer' | 'flowStep'

async function domainIdOf(kind: ResourceKind, id: string): Promise<string | null> {
  const select = { domainId: true } as const
  switch (kind) {
    case 'chatRoom': return (await client.chatRoom.findUnique({ where: { id }, select }))?.domainId ?? null
    case 'booking': return (await client.booking.findUnique({ where: { id }, select }))?.domainId ?? null
    case 'customer': return (await client.customer.findUnique({ where: { id }, select }))?.domainId ?? null
    case 'flowStep': return (await client.flowStep.findUnique({ where: { id }, select }))?.domainId ?? null
  }
}

/** Use when you only have a child id. Missing resource and "not a member" look identical (FORBIDDEN). */
export async function requireResourceAccess(kind: ResourceKind, id: string, minRole: MinRole = 'AGENT') {
  const domainId = await domainIdOf(kind, id)
  if (!domainId) throw new AuthError('FORBIDDEN')
  const access = await requireDomainAccess(domainId, minRole)
  return { ...access, domainId }
}
