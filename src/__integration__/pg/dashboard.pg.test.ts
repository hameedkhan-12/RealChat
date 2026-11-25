import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { currentUser } from '@clerk/nextjs/server'
import { client } from '@/lib/prisma'
import { getUserConversationStats } from '@/actions/dashboard'
import {
  onGetDomainChatRooms,
  onGetChatMessages,
  onGetCustomerAnswers,
} from '@/actions/conversation'
import {
  uid,
  seedDomain,
  seedUser,
  seedDomainMember,
  seedCustomer,
  seedRoom,
  cleanup,
} from './seed'

vi.mock('@clerk/nextjs/server', () => ({ currentUser: vi.fn(() => Promise.resolve(null)) }))

function setClerk(clerkId: string) {
  vi.mocked(currentUser).mockResolvedValue({ id: clerkId } as any)
}

describe('dashboard conversation stats (real PostgreSQL)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(async () => { await cleanup() })

  it('returns tenant-scoped conversation stats for a user', async () => {
    const domain = await seedDomain()
    const { id: userId, clerkId } = await seedUser()
    await seedDomainMember({ domainId: domain.id, userId: userId, role: 'OWNER' })

    const customer = await seedCustomer({ domainId: domain.id })
    await seedRoom({ id: uid(), domainId: domain.id, customerId: customer.id, status: 'LIVE' })
    await seedRoom({ id: uid(), domainId: domain.id, customerId: customer.id, status: 'WAITING_AGENT' })
    await seedRoom({ id: uid(), domainId: domain.id, customerId: customer.id, status: 'CLOSED' })
    await seedRoom({ id: uid(), domainId: domain.id, customerId: customer.id, status: 'LIVE', assignedToUserId: userId })

    setClerk(clerkId)
    const res = await getUserConversationStats()
    expect(res?.ok).toBe(true)
    const stats = (res as any).data as { total: number; live: number; waitingAgent: number; closed: number; assignedToMe: number }
    expect(stats.total).toBe(4)
    expect(stats.live).toBe(2)
    expect(stats.waitingAgent).toBe(1)
    expect(stats.closed).toBe(1)
    expect(stats.assignedToMe).toBe(1)
  })

  it('returns zeros when user has no domains', async () => {
    const { id: userId, clerkId } = await seedUser()
    setClerk(clerkId)
    const res = await getUserConversationStats()
    expect(res?.ok).toBe(true)
    const stats = (res as any).data as { total: number }
    expect(stats.total).toBe(0)
  })

  it('does not return conversations from another tenant', async () => {
    const domainA = await seedDomain()
    const domainB = await seedDomain()
    const { id: userId, clerkId } = await seedUser()
    await seedDomainMember({ domainId: domainA.id, userId: userId, role: 'OWNER' })

    const customerA = await seedCustomer({ domainId: domainA.id })
    const customerB = await seedCustomer({ domainId: domainB.id })
    await seedRoom({ id: uid(), domainId: domainA.id, customerId: customerA.id, status: 'LIVE' })
    await seedRoom({ id: uid(), domainId: domainB.id, customerId: customerB.id, status: 'LIVE' })

    setClerk(clerkId)
    const res = await getUserConversationStats()
    const stats = (res as any).data as { total: number }
    expect(stats.total).toBe(1)
  })
})

describe('dashboard conversation search (real PostgreSQL)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(async () => { await cleanup() })

  it('filters conversations by customer name or email', async () => {
    const domain = await seedDomain()
    const { id: userId, clerkId } = await seedUser()
    await seedDomainMember({ domainId: domain.id, userId: userId, role: 'OWNER' })

    const customerAlpha = await seedCustomer({ domainId: domain.id, email: 'alpha@example.com', name: 'Alpha Customer' })
    const customerBeta = await seedCustomer({ domainId: domain.id, email: 'beta@example.com', name: 'Beta Customer' })
    await seedRoom({ id: uid(), domainId: domain.id, customerId: customerAlpha.id, status: 'LIVE' })
    await seedRoom({ id: uid(), domainId: domain.id, customerId: customerBeta.id, status: 'BOT' })

    setClerk(clerkId)

    const resByEmail = await onGetDomainChatRooms(domain.id, undefined, 'alpha@example.com')
    expect(resByEmail?.ok).toBe(true)
    expect(((resByEmail as any).data as any).items.length).toBe(1)
    expect(((resByEmail as any).data as any).items[0].customer.email).toBe('alpha@example.com')

    const resByName = await onGetDomainChatRooms(domain.id, undefined, 'Beta')
    expect(resByName?.ok).toBe(true)
    expect(((resByName as any).data as any).items.length).toBe(1)
    expect(((resByName as any).data as any).items[0].customer.name).toBe('Beta Customer')
  })

  it('does not return search results from another tenant', async () => {
    const domainA = await seedDomain()
    const domainB = await seedDomain()
    const { id: userId, clerkId } = await seedUser()
    await seedDomainMember({ domainId: domainA.id, userId: userId, role: 'OWNER' })

    const customerA = await seedCustomer({ domainId: domainA.id, email: 'unique@example.com' })
    const customerB = await seedCustomer({ domainId: domainB.id, email: 'unique@example.com' })
    await seedRoom({ id: uid(), domainId: domainA.id, customerId: customerA.id, status: 'LIVE' })
    await seedRoom({ id: uid(), domainId: domainB.id, customerId: customerB.id, status: 'LIVE' })

    setClerk(clerkId)
    const res = await onGetDomainChatRooms(domainA.id, undefined, 'unique@example.com')
    expect(((res as any).data as any).items.length).toBe(1)
    expect(((res as any).data as any).items[0].customer.email).toBe('unique@example.com')
  })
})

describe('dashboard message and questionnaire access (real PostgreSQL)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(async () => { await cleanup() })

  it('returns messages only for authorized conversation', async () => {
    const domain = await seedDomain()
    const { id: userId, clerkId } = await seedUser()
    await seedDomainMember({ domainId: domain.id, userId: userId, role: 'OWNER' })

    const customer = await seedCustomer({ domainId: domain.id })
    const room = await seedRoom({ id: uid(), domainId: domain.id, customerId: customer.id, status: 'LIVE' })

    await client.chatMessage.create({
      data: {
        chatRoomId: room.id,
        message: 'Hello visitor',
        senderType: 'VISITOR',
        senderUserId: null,
        createdAt: new Date(),
      },
    })

    setClerk(clerkId)
    const res = await onGetChatMessages(room.id)
    expect(res?.ok).toBe(true)
    const data = (res as any).data as any[]
    expect(data[0].message.length).toBe(1)
    expect(data[0].message[0].message).toBe('Hello visitor')
  })

  it('rejects cross-tenant conversation access', async () => {
    const domainA = await seedDomain()
    const domainB = await seedDomain()
    const { id: userIdA, clerkId: clerkIdA } = await seedUser()
    const { id: userIdB, clerkId: clerkIdB } = await seedUser()
    await seedDomainMember({ domainId: domainA.id, userId: userIdA, role: 'OWNER' })
    await seedDomainMember({ domainId: domainB.id, userId: userIdB, role: 'OWNER' })

    const customerA = await seedCustomer({ domainId: domainA.id })
    const roomA = await seedRoom({ id: uid(), domainId: domainA.id, customerId: customerA.id, status: 'LIVE' })

    setClerk(clerkIdB)
    await expect(onGetChatMessages(roomA.id)).rejects.toThrow('FORBIDDEN')
  })

  it('returns questionnaire answers for authorized customer', async () => {
    const domain = await seedDomain()
    const { id: userId, clerkId } = await seedUser()
    await seedDomainMember({ domainId: domain.id, userId: userId, role: 'AGENT' })

    const customer = await seedCustomer({ domainId: domain.id })
    await client.customerResponses.create({
      data: {
        id: uid(),
        customerId: customer.id,
        stepKey: 'name',
        question: 'What is your name?',
        answered: 'John Doe',
        createdAt: new Date(),
      },
    })

    setClerk(clerkId)
    const res = await onGetCustomerAnswers(customer.id)
    expect(res?.ok).toBe(true)
    const data = (res as any).data.data as any
    expect(data.questions.length).toBe(1)
    expect(data.questions[0].question).toBe('What is your name?')
    expect(data.questions[0].answered).toBe('John Doe')
  })

  it('rejects cross-tenant customer access', async () => {
    const domainA = await seedDomain()
    const domainB = await seedDomain()
    const { id: userIdA, clerkId: clerkIdA } = await seedUser()
    const { id: userIdB, clerkId: clerkIdB } = await seedUser()
    await seedDomainMember({ domainId: domainA.id, userId: userIdA, role: 'AGENT' })
    await seedDomainMember({ domainId: domainB.id, userId: userIdB, role: 'AGENT' })

    const customerA = await seedCustomer({ domainId: domainA.id })
    setClerk(clerkIdB)
    const res = await onGetCustomerAnswers(customerA.id)
    expect(res?.ok).toBe(false)
    expect((res as any).error).toBe('FORBIDDEN')
  })
})
