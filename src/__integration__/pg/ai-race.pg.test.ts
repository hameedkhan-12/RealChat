import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { currentUser } from '@clerk/nextjs/server'
import { client } from '@/lib/prisma'
import { hashToken } from '@/lib/session'
import { POST as message } from '@/app/api/widget/message/route'
import { POST as takeover } from '@/app/api/agent/takeover/route'
import { getPusherServer } from '@/lib/pusher-server'
import { uid, seedDomain, seedUser, seedDomainMember, seedCustomer, seedRoom, cleanup, countAiMessages, getRoom } from './seed'

const fakePusher = { trigger: vi.fn().mockResolvedValue({}) }
vi.mock('@/lib/pusher-server', () => ({
  getPusherServer: vi.fn(() => fakePusher),
  roomChannel: vi.fn(() => 'private-room-test'),
}))
vi.mock('@/server/knowledge-retrieval', () => ({
  retrieveKnowledge: vi.fn().mockResolvedValue({ candidates: [], usedKnowledgeIds: [], canAnswer: false }),
}))

function makeReq(token: string, body: Record<string, unknown>) {
  return new Request('http://localhost/api/widget/message', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify(body),
  })
}

async function seedBotRoomWithConsent(domainId: string, token = 'tok-ai') {
  const customer = await seedCustomer({ domainId })
  const roomId = uid()
  const room = await seedRoom({
    id: roomId,
    domainId,
    customerId: customer.id,
    status: 'BOT',
    sessionTokenHash: hashToken(token),
    consentAt: new Date(),
    lastActivityAt: new Date(),
  })
  return { customer, room, token }
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

describe('AI ownership race (real PostgreSQL)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(async () => {
    await cleanup()
    // Reset the shared Prisma client pool so heavy $transaction usage in one
    // test does not corrupt the connection used by the next test.
    await client.$disconnect()
  })

  it('AI can persist a response while it still owns the conversation', async () => {
    const domain = await seedDomain()
    const { room, token } = await seedBotRoomWithConsent(domain.id)

    const res = await message(makeReq(token, { kind: 'QUESTION', content: 'What is the office hours?' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.messages.find((m: any) => m.senderType === 'BOT')).toBeDefined()

    expect(await countAiMessages(room.id)).toBe(1)
    const fresh = await getRoom(room.id)
    expect(fresh?.status).toBe('BOT')
  })

  it('AI cannot persist after the conversation is taken over (LIVE)', async () => {
    const domain = await seedDomain()
    const customer = await seedCustomer({ domainId: domain.id })
    const { user: agent } = await seedAgent(domain.id)
    const roomId = uid()
    await seedRoom({
      id: roomId,
      domainId: domain.id,
      customerId: customer.id,
      status: 'LIVE',
      assignedToUserId: agent.id,
      consentAt: new Date(),
      sessionTokenHash: hashToken('tok-ai'),
    })

    const res = await message(makeReq('tok-ai', { kind: 'QUESTION', content: 'anything' }))
    expect(res.status).toBe(403)
    expect(await countAiMessages(roomId)).toBe(0)
    const fresh = await getRoom(roomId)
    expect(fresh?.status).toBe('LIVE')
  })

  it('concurrent AI response vs takeover: never both persisted (real DB race)', async () => {
    const domain = await seedDomain()
    const { user: userA, clerkId: clerkIdA } = await seedAgent(domain.id)
    const { user: userB } = await seedAgent(domain.id)

    const iterations = 4
    for (let i = 0; i < iterations; i++) {
      const customer = await seedCustomer({ domainId: domain.id })
      const roomId = uid()
      await seedRoom({
        id: roomId,
        domainId: domain.id,
        customerId: customer.id,
        status: 'BOT',
        sessionTokenHash: hashToken(`tok-${i}`),
        consentAt: new Date(),
        lastActivityAt: new Date(),
      })

      vi.mocked(currentUser).mockResolvedValueOnce({ id: clerkIdA } as any)
      vi.mocked(currentUser).mockResolvedValueOnce({ id: `clerk-${uid()}` } as any)

      const aiPromise = message(makeReq(`tok-${i}`, { kind: 'QUESTION', content: 'race question' }))
      const takeoverPromise = (async () => {
        const req = new Request('http://localhost/api/agent/takeover', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ domainId: domain.id, chatRoomId: roomId }),
        })
        return takeover(req)
      })()

      const [aiRes, takeRes] = await Promise.all([aiPromise, takeoverPromise])
      const aiJson = await aiRes.json()
      const fresh = await getRoom(roomId)
      const aiCount = await countAiMessages(roomId)

      expect(!(aiCount === 1 && fresh?.status === 'LIVE')).toBe(true)
      if (fresh?.status === 'LIVE') {
        expect([userA.id, userB.id]).toContain(fresh?.assignedToUserId)
        expect(aiCount).toBe(0)
      }
      void aiJson
      void takeRes
    }
  })

  it('publishes only after a successful AI message commit', async () => {
    const domain = await seedDomain()
    const { room, token } = await seedBotRoomWithConsent(domain.id)

    fakePusher.trigger.mockClear()
    const res = await message(makeReq(token, { kind: 'QUESTION', content: 'publish check' }))
    expect(res.status).toBe(200)
    expect(await countAiMessages(room.id)).toBe(1)
    expect(fakePusher.trigger).toHaveBeenCalled()
  })
})
