import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { currentUser } from '@clerk/nextjs/server'
import { client } from '@/lib/prisma'
import { POST as takeover } from '@/app/api/agent/takeover/route'
import { uid, seedDomain, seedUser, seedDomainMember, seedCustomer, seedRoom, cleanup, getRoom } from './seed'

function makeReq(domainId: string, chatRoomId: string, body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/agent/takeover', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domainId, chatRoomId, ...body }),
  })
}

async function seedAgent(domainId: string, clerkId?: string) {
  const clerkIdValue = clerkId ?? `clerk-${uid()}`
  const user = await seedUser({ clerkId: clerkIdValue, fullname: 'Test Agent' })
  await seedDomainMember({ domainId, userId: user.id, role: 'AGENT' })
  return { user, clerkId: clerkIdValue }
}

async function seedWaitingRoom(domainId: string) {
  const customer = await seedCustomer({ domainId })
  const roomId = uid()
  const room = await seedRoom({ id: roomId, domainId, customerId: customer.id, status: 'WAITING_AGENT' })
  return { room, customer }
}

function setClerk(clerkId: string) {
  vi.mocked(currentUser).mockResolvedValue({ id: clerkId } as any)
}

describe('agent takeover (real PostgreSQL)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(async () => { await cleanup() })

  it('authorized agent claims a WAITING_AGENT room atomically', async () => {
    const domain = await seedDomain()
    const { user, clerkId } = await seedAgent(domain.id)
    const { room } = await seedWaitingRoom(domain.id)

    setClerk(clerkId)
    const res = await takeover(makeReq(domain.id, room.id))
    expect(res.status).toBe(200)
    await res.json()

    const fresh = await getRoom(room.id)
    expect(fresh?.status).toBe('LIVE')
    expect(fresh?.assignedToUserId).toBe(user.id)
  })

  it('agent cannot claim a BOT conversation directly', async () => {
    const domain = await seedDomain()
    const { user, clerkId } = await seedAgent(domain.id)
    const customer = await seedCustomer({ domainId: domain.id })
    const room = await seedRoom({ id: uid(), domainId: domain.id, customerId: customer.id, status: 'BOT' })

    setClerk(clerkId)
    const res = await takeover(makeReq(domain.id, room.id))
    expect(res.status).toBe(409)
    const fresh = await getRoom(room.id)
    expect(fresh?.status).toBe('BOT')
    expect(fresh?.assignedToUserId).toBeNull()
  })

  it('agent cannot claim a closed conversation', async () => {
    const domain = await seedDomain()
    const { user, clerkId } = await seedAgent(domain.id)
    const customer = await seedCustomer({ domainId: domain.id })
    const room = await seedRoom({ id: uid(), domainId: domain.id, customerId: customer.id, status: 'CLOSED' })

    setClerk(clerkId)
    const res = await takeover(makeReq(domain.id, room.id))
    expect(res.status).toBe(409)
  })

  it('agent from another tenant is rejected', async () => {
    const domainA = await seedDomain()
    const domainB = await seedDomain()
    const { user, clerkId } = await seedAgent(domainA.id)
    const customer = await seedCustomer({ domainId: domainB.id })
    const room = await seedRoom({ id: uid(), domainId: domainB.id, customerId: customer.id, status: 'WAITING_AGENT' })

    setClerk(clerkId)
    const res = await takeover(makeReq(domainB.id, room.id))
    expect(res.status).toBe(403)
    const fresh = await getRoom(room.id)
    expect(fresh?.status).toBe('WAITING_AGENT')
    expect(fresh?.assignedToUserId).toBeNull()
  })

  it('repeated takeover does not overwrite the assigned agent', async () => {
    const domain = await seedDomain()
    const { user: user1, clerkId: clerkId1 } = await seedAgent(domain.id)
    await seedAgent(domain.id)
    const { room } = await seedWaitingRoom(domain.id)

    setClerk(clerkId1)
    const res1 = await takeover(makeReq(domain.id, room.id))
    expect(res1.status).toBe(200)

    setClerk(clerkId1)
    const res2 = await takeover(makeReq(domain.id, room.id))
    expect(res2.status).toBe(200)

    const fresh = await getRoom(room.id)
    expect(fresh?.assignedToUserId).toBe(user1.id)
  })

  it('concurrent takeover: exactly one agent succeeds (real DB race)', async () => {
    const domain = await seedDomain()
    const { user: userA, clerkId: clerkIdA } = await seedAgent(domain.id)
    const { user: userB, clerkId: clerkIdB } = await seedAgent(domain.id)
    const { room } = await seedWaitingRoom(domain.id)

    vi.mocked(currentUser).mockResolvedValueOnce({ id: clerkIdA } as any)
    vi.mocked(currentUser).mockResolvedValueOnce({ id: clerkIdB } as any)

    const resA = takeover(makeReq(domain.id, room.id))
    const resB = takeover(makeReq(domain.id, room.id))

    const [outA, outB] = await Promise.all([resA, resB])
    const statuses = [outA.status, outB.status].sort()
    expect(statuses).toEqual([200, 409])

    const fresh = await getRoom(room.id)
    expect(fresh?.status).toBe('LIVE')
    expect([userA.id, userB.id]).toContain(fresh?.assignedToUserId)
    expect(fresh?.assignedToUserId).not.toBeNull()
  })
})
