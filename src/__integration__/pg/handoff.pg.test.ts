import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { client } from '@/lib/prisma'
import { hashToken } from '@/lib/session'
import { POST as handoff } from '@/app/api/widget/handoff/route'
import { uid, seedDomain, seedUser, seedDomainMember, seedCustomer, seedRoom, cleanup, getRoom } from './seed'

function makeReq(token: string, body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/widget/handoff', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

async function seedAgent(domainId: string, clerkId?: string) {
  const clerkIdValue = clerkId ?? `clerk-${uid()}`
  const user = await seedUser({ clerkId: clerkIdValue, fullname: 'Test Agent' })
  await seedDomainMember({ domainId, userId: user.id, role: 'AGENT' })
  return { user, clerkId: clerkIdValue }
}

async function seedBotRoom(domainId: string, token = 'tok-1') {
  const customer = await seedCustomer({ domainId })
  const roomId = uid()
  const room = await seedRoom({
      id: roomId,
      domainId,
      customerId: customer.id,
    status: 'BOT',
    sessionTokenHash: hashToken(token),
    lastActivityAt: new Date(),
  })
  return { customer, room, token }
}

describe('widget handoff (real PostgreSQL)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(async () => { await cleanup() })

  it('transitions a BOT room to WAITING_AGENT and persists it', async () => {
    const domain = await seedDomain()
    const { room, token } = await seedBotRoom(domain.id)

    const res = await handoff(makeReq(token))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.status).toBe('WAITING_AGENT')

    const fresh = await getRoom(room.id)
    expect(fresh?.status).toBe('WAITING_AGENT')
    expect(fresh?.assignedToUserId).toBeNull()
  })

  it('is idempotent: repeated handoff on an already-waiting room is safe', async () => {
    const domain = await seedDomain()
    const { room, token } = await seedBotRoom(domain.id)

    await handoff(makeReq(token))
    const res2 = await handoff(makeReq(token))
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2.ok).toBe(true)
    expect(json2.status).toBe('WAITING_AGENT')

    const fresh = await getRoom(room.id)
    expect(fresh?.status).toBe('WAITING_AGENT')
  })

  it('rejects an invalid/unknown session token', async () => {
    const domain = await seedDomain()
    await seedBotRoom(domain.id, 'tok-1')

    const res = await handoff(makeReq('does-not-exist'))
    expect(res.status).toBe(401)
  })

  it('rejects an expired widget session', async () => {
    const domain = await seedDomain()
    const customer = await seedCustomer({ domainId: domain.id })
    const roomId = uid()
    await seedRoom({
      id: roomId,
      domainId: domain.id,
      customerId: customer.id,
      status: 'BOT',
      sessionTokenHash: hashToken('expired-tok'),
      lastActivityAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25h ago, past 24h TTL
    })

    const res = await handoff(makeReq('expired-tok'))
    expect(res.status).toBe(401)
  })

  it('rejects handoff from a closed conversation', async () => {
    const domain = await seedDomain()
    const { room, token } = await seedBotRoom(domain.id)
    await client.chatRoom.update({ where: { id: room.id }, data: { status: 'CLOSED' } })

    const res = await handoff(makeReq(token))
    expect(res.status).toBe(409)
  })

  it('rejects handoff from a LIVE (agent-owned) conversation', async () => {
    const domain = await seedDomain()
    const { room, token } = await seedBotRoom(domain.id)
    const { user: agent } = await seedAgent(domain.id)
    await client.chatRoom.update({ where: { id: room.id }, data: { status: 'LIVE', assignedToUserId: agent.id } })

    const res = await handoff(makeReq(token))
    expect(res.status).toBe(409)
    const fresh = await getRoom(room.id)
    expect(fresh?.status).toBe('LIVE')
    expect(fresh?.assignedToUserId).toBe(agent.id)
  })

  it('keeps tenant isolation: a session for one domain cannot touch another domain room', async () => {
    const domainA = await seedDomain()
    const domainB = await seedDomain()
    const roomA = await seedBotRoom(domainA.id, 'tok-a')
    await seedBotRoom(domainB.id, 'tok-b')

    await handoff(makeReq('tok-a'))
    const freshA = await getRoom(roomA.room.id)
    const freshB = await getRoom(await (async () => {
      const all = await client.chatRoom.findMany({ where: { domainId: domainB.id } })
      return all[0].id
    })())

    expect(freshA?.status).toBe('WAITING_AGENT')
    expect(freshB?.status).toBe('BOT')
  })
})

