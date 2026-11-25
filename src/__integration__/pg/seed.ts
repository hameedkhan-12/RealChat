import { client } from '@/lib/prisma'
import { hashToken } from '@/lib/session'

export type SeedUser = { id: string; clerkId: string; fullname: string }
export type SeedDomain = { id: string; name: string; publicKey: string }
export type SeedMember = { id: string; domainId: string; userId: string; role: 'OWNER' | 'AGENT' }
export type SeedCustomer = { id: string; domainId: string; email?: string; name?: string }
export type SeedRoom = {
  id: string
  domainId: string
  customerId: string
  status: 'BOT' | 'WAITING_AGENT' | 'LIVE' | 'CLOSED'
  sessionTokenHash?: string | null
  assignedToUserId?: string | null
  lastActivityAt?: Date
  consentAt?: Date | null
}

const created: Array<{ model: string; where: Record<string, unknown> }> = []

export function uid(): string {
  return crypto.randomUUID()
}

export async function seedDomain(input?: { id?: string; name?: string; publicKey?: string }): Promise<SeedDomain> {
  const id = input?.id ?? uid()
  const domain = await client.domain.create({
    data: { id, name: input?.name ?? 'Test Domain', publicKey: input?.publicKey ?? uid() },
  })
  created.push({ model: 'domain', where: { id } })
  return { id: domain.id, name: domain.name, publicKey: domain.publicKey }
}

export async function seedUser(input?: { id?: string; clerkId?: string; fullname?: string }): Promise<SeedUser> {
  const id = input?.id ?? uid()
  const clerkId = input?.clerkId ?? `clerk-${id}`
  const user = await client.user.create({
    data: { id, clerkId, fullname: input?.fullname ?? 'Test User', type: 'owner' },
  })
  created.push({ model: 'user', where: { id } })
  return { id: user.id, clerkId: user.clerkId, fullname: user.fullname }
}

export async function seedDomainMember(
  input: { domainId: string; userId: string; role?: 'OWNER' | 'AGENT' },
): Promise<SeedMember> {
  const id = uid()
  const member = await client.domainMember.create({
    data: { id, domainId: input.domainId, userId: input.userId, role: input.role ?? 'AGENT' },
  })
  created.push({ model: 'domainMember', where: { id } })
  return { id: member.id, domainId: member.domainId, userId: member.userId, role: member.role }
}

export async function seedCustomer(input?: { id?: string; domainId: string; email?: string; name?: string }): Promise<SeedCustomer> {
  if (!input?.domainId) throw new Error('seedCustomer requires domainId')
  const id = input?.id ?? uid()
  const customer = await client.customer.create({
    data: { id, domainId: input.domainId, email: input?.email, name: input?.name },
  })
  created.push({ model: 'customer', where: { id } })
  return { id: customer.id, domainId: customer.domainId, email: customer.email ?? undefined, name: customer.name ?? undefined }
}

export async function seedRoom(input: SeedRoom): Promise<SeedRoom> {
  const room = await client.chatRoom.create({
    data: {
      id: input.id,
      domainId: input.domainId,
      customerId: input.customerId,
      status: input.status,
      sessionTokenHash: input.sessionTokenHash ?? null,
      assignedToUserId: input.assignedToUserId ?? null,
      lastActivityAt: input.lastActivityAt ?? new Date(),
      consentAt: input.consentAt ?? null,
    },
  })
  created.push({ model: 'chatRoom', where: { id: room.id } })
  return {
    id: room.id,
    domainId: room.domainId,
    customerId: room.customerId,
    status: room.status,
    sessionTokenHash: room.sessionTokenHash,
    assignedToUserId: room.assignedToUserId,
    lastActivityAt: room.lastActivityAt,
    consentAt: room.consentAt,
  }
}

export async function seedVisitorSession(token: string, roomId: string): Promise<void> {
  await client.chatRoom.update({
    where: { id: roomId },
    data: { sessionTokenHash: hashToken(token) },
  })
}

export async function seedKnowledgeItem(input: { domainId: string; title?: string; content?: string }) {
  const item = await client.knowledgeItem.create({
    data: {
      id: uid(),
      domainId: input.domainId,
      title: input.title ?? 'Test item',
      content: input.content ?? 'Test content',
      isActive: true,
    },
  })
  created.push({ model: 'knowledgeItem', where: { id: item.id } })
  return item
}

export async function cleanup(): Promise<void> {
  // Reverse order to respect foreign keys
  for (const entry of created.slice().reverse()) {
    try {
      await (client as any)[entry.model].delete({ where: entry.where as any })
    } catch {
      // Already gone or FK-protected; best effort
    }
  }
  created.length = 0
}

export async function countAiMessages(chatRoomId: string): Promise<number> {
  return client.chatMessage.count({ where: { chatRoomId, senderType: 'BOT' } })
}

export async function countAgentMessages(chatRoomId: string): Promise<number> {
  return client.chatMessage.count({ where: { chatRoomId, senderType: 'AGENT' } })
}

export async function getRoom(chatRoomId: string) {
  return client.chatRoom.findUnique({ where: { id: chatRoomId } })
}

