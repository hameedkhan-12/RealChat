import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockUpdate = vi.fn()
const mockFindUnique = vi.fn()
const mockRateLimit = vi.fn().mockResolvedValue({ success: true })

vi.mock('@/lib/prisma', () => ({
  client: {
    chatRoom: { findUnique: mockFindUnique, update: mockUpdate },
  },
}))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mockRateLimit, getClientIp: () => '1.2.3.4' }))
vi.mock('@/lib/widget-auth', () => ({
  requireWidgetSession: vi.fn(() => Promise.resolve({ room: { id: 'room-1', domainId: 'domain-1', status: 'BOT', consentAt: new Date(), currentStepKey: null } })),
}))
vi.mock('@/lib/http', () => ({
  handle: (fn: any) => async (req: Request) => {
    try { return await fn(req) } catch (e: any) { return new Response(JSON.stringify({ ok: false, error: e.code }), { status: e.status ?? 500 }) }
  },
  HttpError: class extends Error {
    status: number; code: string
    constructor(status: number, code: string) { super(code); this.status = status; this.code = code }
  },
}))
vi.mock('@/lib/mail', () => ({ sendMail: vi.fn() }))
vi.mock('@/lib/pusher-server', () => ({
  getPusherServer: vi.fn(() => null),
  roomChannel: vi.fn(() => 'private-room-room-1'),
}))

function makeReq() {
  return new Request('http://localhost/api/widget/handoff', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  })
}

describe('widget handoff', () => {
  beforeEach(() => {
    mockRateLimit.mockResolvedValue({ success: true })
    mockFindUnique.mockResolvedValue({ id: 'room-1', domainId: 'domain-1', status: 'BOT', consentAt: new Date(), currentStepKey: null })
    mockUpdate.mockResolvedValue({})
  })

  it('transitions BOT room to WAITING_AGENT on handoff', async () => {
    const { POST } = await import('@/app/api/widget/handoff/route')
    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.status).toBe('WAITING_AGENT')
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: { status: 'WAITING_AGENT', lastActivityAt: expect.any(Date) },
    })
  })

  it('is idempotent: repeated handoff on already WAITING_AGENT room returns current state', async () => {
    mockFindUnique.mockResolvedValue({ id: 'room-1', domainId: 'domain-1', status: 'WAITING_AGENT', consentAt: new Date(), currentStepKey: null })
    const { POST } = await import('@/app/api/widget/handoff/route')
    const res1 = await POST(makeReq())
    expect(res1.status).toBe(200)
    const json1 = await res1.json()
    expect(json1.ok).toBe(true)
    expect(json1.status).toBe('WAITING_AGENT')
    // update should NOT be called for already-waiting room
    expect(mockUpdate).not.toHaveBeenCalled()

    // Second request still returns success
    const res2 = await POST(makeReq())
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2.ok).toBe(true)
    expect(json2.status).toBe('WAITING_AGENT')
  })

  it('rejects handoff from CLOSED room', async () => {
    mockFindUnique.mockResolvedValue({ id: 'room-1', domainId: 'domain-1', status: 'CLOSED', consentAt: new Date(), currentStepKey: null })
    const { POST } = await import('@/app/api/widget/handoff/route')
    const res = await POST(makeReq())
    expect(res.status).toBe(409)
  })

  it('rejects handoff from LIVE room', async () => {
    mockFindUnique.mockResolvedValue({ id: 'room-1', domainId: 'domain-1', status: 'LIVE', consentAt: new Date(), currentStepKey: null })
    const { POST } = await import('@/app/api/widget/handoff/route')
    const res = await POST(makeReq())
    expect(res.status).toBe(409)
  })

  it('rejects rate limited requests', async () => {
    mockRateLimit.mockResolvedValue({ success: false })
    const { POST } = await import('@/app/api/widget/handoff/route')
    const res = await POST(makeReq())
    expect(res.status).toBe(429)
  })
})
