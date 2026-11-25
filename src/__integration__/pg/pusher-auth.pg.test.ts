import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { currentUser } from '@clerk/nextjs/server'
import { client } from '@/lib/prisma'
import { hashToken } from '@/lib/session'
import { POST as pusherAuth } from '@/app/api/pusher/auth/route'
import { uid, seedDomain, seedUser, seedDomainMember, seedCustomer, seedRoom, cleanup } from './seed'

function makeReq(socketId: string, channelName: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/pusher/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
  })
}

async function seedAgent(domainId: string, clerkId?: string) {
  const clerkIdValue = clerkId ?? `clerk-${uid()}`
  const user = await seedUser({ clerkId: clerkIdValue, fullname: 'Test Agent' })
  await seedDomainMember({ domainId, userId: user.id, role: 'AGENT' })
  return { user, clerkId: clerkIdValue }
}

function setClerk(clerkId: string | null) {
  vi.mocked(currentUser).mockResolvedValue(clerkId ? ({ id: clerkId } as any) : null)
}

describe('pusher auth (real PostgreSQL)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(async () => { await cleanup() })

  it('authorizes widget visitor for their own room channel', async () => {
    const domain = await seedDomain()
    const customer = await seedCustomer({ domainId: domain.id })
    const roomId = uid()
    await seedRoom({ id: roomId, domainId: domain.id, customerId: customer.id, status: 'BOT', sessionTokenHash: hashToken('tok-v') })

    const res = await pusherAuth(makeReq('socket-1', `private-room-${roomId}`, { authorization: 'Bearer tok-v' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.auth).toContain(':')
  })

  it('rejects widget visitor for another room channel', async () => {
    const domain = await seedDomain()
    const customer = await seedCustomer({ domainId: domain.id })
    const roomId = uid()
    await seedRoom({ id: roomId, domainId: domain.id, customerId: customer.id, status: 'BOT', sessionTokenHash: hashToken('tok-v') })

    const res = await pusherAuth(makeReq('socket-1', 'private-room-other', { authorization: 'Bearer tok-v' }))
    expect(res.status).toBe(403)
  })

  it('rejects unknown channel patterns for visitor', async () => {
    const domain = await seedDomain()
    const customer = await seedCustomer({ domainId: domain.id })
    const roomId = uid()
    await seedRoom({ id: roomId, domainId: domain.id, customerId: customer.id, status: 'BOT', sessionTokenHash: hashToken('tok-v') })

    const res = await pusherAuth(makeReq('socket-1', 'private-other-room-1', { authorization: 'Bearer tok-v' }))
    expect(res.status).toBe(403)
  })

  it('rejects invalid widget session', async () => {
    const res = await pusherAuth(makeReq('socket-1', 'private-room-room-1', { authorization: 'Bearer bad-token' }))
    expect(res.status).toBe(401)
  })

  it('authorizes clerk agent for a domain channel they belong to', async () => {
    const domain = await seedDomain()
    const { clerkId } = await seedAgent(domain.id)
    setClerk(clerkId)

    const res = await pusherAuth(makeReq('socket-1', `private-domain-${domain.id}`))
    expect(res.status).toBe(200)
  })

  it('authorizes clerk agent for a room channel in their own tenant', async () => {
    const domain = await seedDomain()
    const customer = await seedCustomer({ domainId: domain.id })
    const roomId = uid()
    await seedRoom({ id: roomId, domainId: domain.id, customerId: customer.id, status: 'LIVE' })
    const { clerkId } = await seedAgent(domain.id)
    setClerk(clerkId)

    const res = await pusherAuth(makeReq('socket-1', `private-room-${roomId}`))
    expect(res.status).toBe(200)
  })

  it('rejects clerk agent for a room channel in another tenant', async () => {
    const domainA = await seedDomain()
    const domainB = await seedDomain()
    const customer = await seedCustomer({ domainId: domainB.id })
    const roomId = uid()
    await seedRoom({ id: roomId, domainId: domainB.id, customerId: customer.id, status: 'LIVE' })
    const { clerkId } = await seedAgent(domainA.id)
    setClerk(clerkId)

    const res = await pusherAuth(makeReq('socket-1', `private-room-${roomId}`))
    expect(res.status).toBe(403)
  })

  it('rejects unknown channel for clerk agent', async () => {
    const domain = await seedDomain()
    const { clerkId } = await seedAgent(domain.id)
    setClerk(clerkId)

    const res = await pusherAuth(makeReq('socket-1', 'private-unknown-xyz'))
    expect(res.status).toBe(403)
  })

  it('rejects unauthenticated agent with no session', async () => {
    setClerk(null)
    const res = await pusherAuth(makeReq('socket-1', 'private-domain-some'))
    expect(res.status).toBe(401)
  })
})
