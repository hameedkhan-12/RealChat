import { describe, it, expect, beforeEach, vi } from 'vitest'
import { client } from '@/lib/prisma'
import { requireWidgetSession } from '@/lib/widget-auth'

vi.mock('@/lib/prisma', () => ({
  client: {
    chatRoom: { findUnique: vi.fn(), update: vi.fn() },
    chatMessage: { create: vi.fn() },
    flowStep: { findMany: vi.fn(), findFirst: vi.fn() },
    customerResponses: { findUnique: vi.fn(), create: vi.fn() },
    customer: { update: vi.fn() },
    chatBot: { findUnique: vi.fn() },
    knowledgeItem: { findMany: vi.fn() },
    $transaction: vi.fn(async (cb) => cb(client)),
  },
}))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue({ success: true }), getClientIp: () => '1.2.3.4' }))
vi.mock('@/lib/widget-auth', () => ({
  requireWidgetSession: vi.fn(() => Promise.resolve({ room: { id: 'room-1', domainId: 'domain-1', status: 'BOT', consentAt: new Date(), currentStepKey: null } })),
}))
vi.mock('@/lib/pusher-server', () => ({
  getPusherServer: vi.fn(() => null),
  roomChannel: vi.fn(() => 'private-room-room-1'),
}))
vi.mock('@/lib/http', () => ({
  handle: (fn: any) => async (req: Request) => {
    try { return await fn(req) } catch (e: any) { return new Response(JSON.stringify({ ok: false, error: e.code }), { status: e.status ?? 500 }) }
  },
  assertSameOrigin: () => {},
  readJson: async (req: Request) => req.json(),
  HttpError: class extends Error {
    status: number; code: string
    constructor(status: number, code: string) { super(code); this.status = status; this.code = code }
  },
}))

const baseSteps = [
  { id: 's1', key: 'step1', type: 'CHOICE', prompt: 'Buy or rent?', options: [{ label: 'Buy', value: 'buy', nextStepKey: 'step2' }, { label: 'Rent', value: 'rent' }], required: true, mapsTo: 'NONE', isActive: true, domainId: 'domain-1', position: 1 },
  { id: 's2', key: 'step2', type: 'TEXT', prompt: 'Budget?', options: null, required: true, mapsTo: 'NONE', isActive: true, domainId: 'domain-1', position: 2 },
  { id: 's3', key: 'step3', type: 'EMAIL', prompt: 'Email?', options: null, required: true, mapsTo: 'EMAIL', isActive: true, domainId: 'domain-1', position: 3 },
  { id: 's4', key: 'step4', type: 'PHONE', prompt: 'Phone?', options: null, required: false, mapsTo: 'PHONE', isActive: true, domainId: 'domain-1', position: 4 },
]

function makeReq(kind: string, body: any) {
  return new Request('http://localhost/api/widget/message', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ kind, ...body }),
  })
}

function setRoom(currentStepKey: string | null, consentAt = new Date(), status: string = 'BOT') {
  vi.mocked(requireWidgetSession).mockResolvedValue({ room: { id: 'room-1', domainId: 'domain-1', status: status as any, consentAt, currentStepKey } } as any)
}

function setSteps(steps = baseSteps) {
  ;(client.flowStep.findMany as any).mockResolvedValue(steps)
}

describe('questionnaire lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRoom(null)
    setSteps(baseSteps)
    ;(client.flowStep.findFirst as any).mockResolvedValue(null)
    ;(client.customerResponses.findUnique as any).mockResolvedValue(null)
    ;(client.customerResponses.create as any).mockResolvedValue({})
    ;(client.customer.update as any).mockResolvedValue({})
    ;(client.chatRoom.update as any).mockResolvedValue({})
    ;(client.chatMessage.create as any).mockResolvedValue({ id: 'msg-1' })
    ;(client.chatBot.findUnique as any).mockResolvedValue({ bookingEnabled: true, handoffEnabled: true })
    ;(client.knowledgeItem.findMany as any).mockResolvedValue([])
  })

  it('advances through flow on valid answers', async () => {
    const { POST } = await import('@/app/api/widget/message/route')
    // Answer step1 (CHOICE) -> advances to step2
    setRoom('step1')
    let res = await POST(makeReq('FLOW_ANSWER', { stepKey: 'step1', answer: 'buy' }))
    expect(res.status).toBe(200)
    let json = await res.json()
    expect(json.flowCompleted).toBe(false)
    expect(json.currentStep.key).toBe('step2')

    // Answer step2 (TEXT) -> advances to step3
    setRoom('step2')
    res = await POST(makeReq('FLOW_ANSWER', { stepKey: 'step2', answer: '$500k' }))
    json = await res.json()
    expect(json.currentStep.key).toBe('step3')

    // Answer step3 (EMAIL) -> advances to step4 (optional)
    setRoom('step3')
    res = await POST(makeReq('FLOW_ANSWER', { stepKey: 'step3', answer: 'test@example.com' }))
    json = await res.json()
    expect(json.currentStep.key).toBe('step4')
    expect(json.flowCompleted).toBe(false)
    // Room status stays BOT
    expect(json.room.status).toBe('BOT')

    // Skip optional step4 (no answer) -> flow completes
    setRoom('step4')
    res = await POST(makeReq('FLOW_ANSWER', { stepKey: 'step4', answer: null }))
    json = await res.json()
    expect(json.flowCompleted).toBe(true)
    expect(json.room.status).toBe('BOT')
  })

  it('rejects invalid choice answer', async () => {
    const { POST } = await import('@/app/api/widget/message/route')
    setRoom('step1')
    const res = await POST(makeReq('FLOW_ANSWER', { stepKey: 'step1', answer: 'maybe' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.currentStep.key).toBe('step1')
    expect(json.flowCompleted).toBe(false)
  })

  it('rejects invalid email format', async () => {
    const { POST } = await import('@/app/api/widget/message/route')
    setRoom('step3')
    const res = await POST(makeReq('FLOW_ANSWER', { stepKey: 'step3', answer: 'not-an-email' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.currentStep.key).toBe('step3')
    expect(json.flowCompleted).toBe(false)
  })

  it('skips optional step with no answer', async () => {
    const { POST } = await import('@/app/api/widget/message/route')
    setRoom('step4')
    const res = await POST(makeReq('FLOW_ANSWER', { stepKey: 'step4', answer: null }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.flowCompleted).toBe(true)
  })

  it('rejects stale stepKey', async () => {
    const { POST } = await import('@/app/api/widget/message/route')
    setRoom('step2')
    const res = await POST(makeReq('FLOW_ANSWER', { stepKey: 'step1', answer: 'buy' }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('STALE_SUBMISSION')
  })

  it('is idempotent on duplicate answer (no unique constraint crash)', async () => {
    const { POST } = await import('@/app/api/widget/message/route')
    setRoom('step1')
    ;(client.customerResponses.findUnique as any).mockResolvedValue({ id: 'cr-1', customerId: 'cust-1', stepKey: 'step1' })
    const res = await POST(makeReq('FLOW_ANSWER', { stepKey: 'step1', answer: 'buy' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.flowCompleted).toBe(false)
    expect(client.customerResponses.create).not.toHaveBeenCalled()
    expect(client.chatRoom.update).toHaveBeenCalled()
  })

  it('discards AI answer when agent takes over between check and insert (race condition)', async () => {
    const { POST } = await import('@/app/api/widget/message/route')
    // Room is BOT per requireWidgetSession
    setRoom('step3')
    // Inside transaction, freshRoom check finds LIVE (agent took over)
    let findUniqueCallCount = 0
    ;(client.chatRoom.findUnique as any).mockImplementation(async () => {
      findUniqueCallCount++
      if (findUniqueCallCount === 1) {
        return { id: 'room-1', domainId: 'domain-1', status: 'LIVE', assignedToUserId: 'agent-1' }
      }
      return { id: 'room-1', domainId: 'domain-1', status: 'BOT', consentAt: new Date(), currentStepKey: null }
    })
    const res = await POST(makeReq('QUESTION', { content: 'test question' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    // AI answer discarded — only visitor message returned
    expect(json.messages.length).toBe(1)
    expect(json.messages[0].senderType).toBe('VISITOR')
    // Room status is LIVE (agent took over)
    expect(json.room.status).toBe('LIVE')
  })

  it('keeps room open after flow completion for AI Q&A and handover', async () => {
    const { POST } = await import('@/app/api/widget/message/route')
    // Complete the full flow: step1 -> step2 -> step3 -> skip step4
    setRoom('step1')
    await POST(makeReq('FLOW_ANSWER', { stepKey: 'step1', answer: 'buy' }))
    setRoom('step2')
    await POST(makeReq('FLOW_ANSWER', { stepKey: 'step2', answer: '$500k' }))
    setRoom('step3')
    await POST(makeReq('FLOW_ANSWER', { stepKey: 'step3', answer: 'test@example.com' }))
    setRoom('step4')
    const res = await POST(makeReq('FLOW_ANSWER', { stepKey: 'step4', answer: null }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.flowCompleted).toBe(true)
    expect(json.room.status).toBe('BOT')
  })
})
