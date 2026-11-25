import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { currentUser } from '@clerk/nextjs/server'
import { client } from '@/lib/prisma'
import { POST as agentMessage } from '@/app/api/agent/message/route'
import { uid, seedDomain, seedUser, seedDomainMember, seedCustomer, seedRoom, cleanup, countAgentMessages, getRoom } from './seed'

function makeReq(domainId: string, chatRoomId: string, content: string) {
  return new Request('http://localhost/api/agent/message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domainId, chatRoomId, content }),
  })
}

async function seedAgent(domainId: string, clerkId?: string) {
  const clerkIdValue = clerkId ?? `clerk-${uid()}`
  const user = await seedUser({ clerkId: clerkIdValue, fullname: 'Test Agent' })
  await seedDomainMember({ domainId, userId: user.id, role: 'AGENT' })
  return { user, clerkId: clerkIdValue }
}

function setClerk(clerkId: string) {
  vi.mocked(currentUser).mockResolvedValue({ id: clerkId } as any)
}

async function seedLiveRoom(domainId: string, assignedToUserId: string | null) {
  const customer = await seedCustomer({ domainId })
  const roomId = uid()
  const room = await seedRoom({ id: roomId, domainId, customerId: customer.id, status: 'LIVE', assignedToUserId })
  return { room, customer }
}

describe('agent messaging (real PostgreSQL)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(async () => { await cleanup() })

  it('assigned agent can send a message in a LIVE conversation', async () => {
    const domain = await seedDomain()
    const { user, clerkId } = await seedAgent(domain.id)
    const { room } = await seedLiveRoom(domain.id, user.id)

    setClerk(clerkId)
    const res = await agentMessage(makeReq(domain.id, room.id, 'Hello visitor'))
    expect(res.status).toBe(200)
    await res.json()

    expect(await countAgentMessages(room.id)).toBe(1)
    const persisted = await client.chatMessage.findFirst({ where: { chatRoomId: room.id } })
    expect(persisted?.senderType).toBe('AGENT')
    expect(persisted?.senderUserId).toBe(user.id)
  })

  it('unassigned agent cannot send a message', async () => {
    const domain = await seedDomain()
    const { user: userA } = await seedAgent(domain.id)
    const { user: userB, clerkId: clerkIdB } = await seedAgent(domain.id)
    const { room } = await seedLiveRoom(domain.id, userA.id)

    setClerk(clerkIdB)
    const res = await agentMessage(makeReq(domain.id, room.id, 'Hello'))
    expect(res.status).toBe(403)
    expect(await countAgentMessages(room.id)).toBe(0)
  })

  it('cross-tenant agent cannot send a message', async () => {
    const domainA = await seedDomain()
    const domainB = await seedDomain()
    const { user: owner } = await seedAgent(domainA.id)
    const { clerkId: clerkIdB } = await seedAgent(domainB.id)
    const customer = await seedCustomer({ domainId: domainA.id })
    const room = await seedRoom({ id: uid(), domainId: domainA.id, customerId: customer.id, status: 'LIVE', assignedToUserId: owner.id })

    setClerk(clerkIdB)
    const res = await agentMessage(makeReq(domainA.id, room.id, 'Hello'))
    expect(res.status).toBe(403)
  })

  it('agent cannot send messages in a BOT conversation', async () => {
    const domain = await seedDomain()
    const { user, clerkId } = await seedAgent(domain.id)
    const customer = await seedCustomer({ domainId: domain.id })
    const room = await seedRoom({ id: uid(), domainId: domain.id, customerId: customer.id, status: 'BOT', assignedToUserId: user.id })

    setClerk(clerkId)
    const res = await agentMessage(makeReq(domain.id, room.id, 'Hello'))
    expect(res.status).toBe(409)
  })

  it('agent cannot send messages in a WAITING_AGENT conversation', async () => {
    const domain = await seedDomain()
    const { user, clerkId } = await seedAgent(domain.id)
    const customer = await seedCustomer({ domainId: domain.id })
    const room = await seedRoom({ id: uid(), domainId: domain.id, customerId: customer.id, status: 'WAITING_AGENT', assignedToUserId: null })

    setClerk(clerkId)
    const res = await agentMessage(makeReq(domain.id, room.id, 'Hello'))
    expect(res.status).toBe(409)
  })

  it('agent cannot send messages in a closed conversation', async () => {
    const domain = await seedDomain()
    const { user, clerkId } = await seedAgent(domain.id)
    const customer = await seedCustomer({ domainId: domain.id })
    const room = await seedRoom({ id: uid(), domainId: domain.id, customerId: customer.id, status: 'CLOSED', assignedToUserId: user.id })

    setClerk(clerkId)
    const res = await agentMessage(makeReq(domain.id, room.id, 'Hello'))
    expect(res.status).toBe(409)
  })

  it('client cannot spoof the sender role; server always uses AGENT', async () => {
    const domain = await seedDomain()
    const { user, clerkId } = await seedAgent(domain.id)
    const { room } = await seedLiveRoom(domain.id, user.id)

    setClerk(clerkId)
    const res = await agentMessage(makeReq(domain.id, room.id, 'Hello'))
    expect(res.status).toBe(200)
    const persisted = await client.chatMessage.findFirst({ where: { chatRoomId: room.id } })
    expect(persisted?.senderType).toBe('AGENT')
    expect(persisted?.senderUserId).toBe(user.id)
  })
})
