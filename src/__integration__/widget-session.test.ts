import { describe, it, expect, beforeEach, vi } from 'vitest'
import { client } from '@/lib/prisma'

const mockCreate = vi.fn()
const mockFindUnique = vi.fn()
const mockRateLimit = vi.fn().mockResolvedValue({ success: true })
const mockVerifyTurnstile = vi.fn().mockResolvedValue(true)

vi.mock('@/lib/prisma', () => ({
  client: {
    domain: { findUnique: mockFindUnique },
    chatRoom: { create: mockCreate },
    customer: { create: vi.fn().mockResolvedValue({ id: 'customer-1' }) },
    $transaction: vi.fn(async (cb) => cb({
      customer: { create: vi.fn().mockResolvedValue({ id: 'customer-1' }) },
      chatRoom: { create: mockCreate },
    })),
  },
}))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mockRateLimit, getClientIp: () => '1.2.3.4' }))
vi.mock('@/lib/widget-auth', () => ({ verifyTurnstile: mockVerifyTurnstile }))
vi.mock('@/lib/http', () => ({
  handle: (fn: any) => async (req: Request) => {
    try {
      return await fn(req)
    } catch (e: any) {
      return new Response(JSON.stringify({ ok: false, error: e.code }), { status: e.status ?? 500 })
    }
  },
  assertSameOrigin: () => {},
  readJson: async (req: Request) => req.json(),
  HttpError: class extends Error {
    status: number
    code: string
    constructor(status: number, code: string) { super(code); this.status = status; this.code = code }
  },
}))

describe('widget session lifecycle', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    mockFindUnique.mockReset()
    mockRateLimit.mockReset()
    mockVerifyTurnstile.mockReset()
    mockRateLimit.mockResolvedValue({ success: true })
    mockVerifyTurnstile.mockResolvedValue(true)
  })

  it('creates exactly 1 ChatRoom and 1 Customer for a valid key', async () => {
    mockFindUnique.mockResolvedValue({ id: 'domain-1' })
    mockCreate.mockResolvedValue({ id: 'room-1' })

    const { POST } = await import('@/app/api/widget/session/route')
    const req = new Request('http://localhost/api/widget/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ key: 'abcdef1234567890abcdef1234567890abcdef12' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.sessionToken).toBeDefined()
    expect(json.chatRoomId).toBe('room-1')
    // chatRoom.create called once with nested customer create
    expect(mockCreate).toHaveBeenCalledTimes(1)
    const createData = mockCreate.mock.calls[0][0].data
    expect(createData.customerId).toBe('customer-1')
    expect(createData.customer).toBeUndefined()
    expect(createData.customerId).toBeDefined()
  })

  it('ignores customerEmail and creates a brand-new customer', async () => {
    mockFindUnique.mockResolvedValue({ id: 'domain-1' })
    mockCreate.mockResolvedValue({ id: 'room-1' })

    const { POST } = await import('@/app/api/widget/session/route')
    const req = new Request('http://localhost/api/widget/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ key: 'abcdef1234567890abcdef1234567890abcdef12', customerEmail: 'victim@x.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const createData = mockCreate.mock.calls[0][0].data
    expect(createData.customerId).toBe('customer-1')
    expect(createData.customer).toBeUndefined()
  })

  it('returns 404 UNKNOWN_KEY for unknown key', async () => {
    mockFindUnique.mockResolvedValue(null)

    const { POST } = await import('@/app/api/widget/session/route')
    const req = new Request('http://localhost/api/widget/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ key: 'unknown-key' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('returns 403 BOT_CHECK_FAILED when turnstile secret set and no token', async () => {
    mockFindUnique.mockResolvedValue({ id: 'domain-1' })
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    vi.stubEnv('NODE_ENV', 'production')
    mockVerifyTurnstile.mockResolvedValue(false)

    const { POST } = await import('@/app/api/widget/session/route')
    const req = new Request('http://localhost/api/widget/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ key: 'abcdef1234567890abcdef1234567890abcdef12' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    vi.unstubAllEnvs()
  })
})
