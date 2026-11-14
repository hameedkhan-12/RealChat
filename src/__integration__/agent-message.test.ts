import { describe, it, expect, beforeEach, vi } from 'vitest'
import { client } from '@/lib/prisma'
import { requireDomainAccess } from '@/lib/auth'

const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockRateLimit = vi.fn().mockResolvedValue({ success: true })

vi.mock('@/lib/prisma', () => ({
  client: {
    chatRoom: { findUnique: mockFindUnique, update: mockUpdate },
    chatMessage: { create: mockCreate },
  },
}))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mockRateLimit, getClientIp: () => '1.2.3.4' }))
vi.mock('@/lib/auth', () => ({
  requireDomainAccess: vi.fn(() => Promise.resolve({ user: { id: 'agent-1' } })),
}))
vi.mock('@/lib/http', () => ({
  handle: (fn: any) => async (req: Request) => {
    try { return await fn(req) } catch (e: any) { return new Response(JSON.stringify({ ok: false, error: e.code }), { status: e.status ?? 500 }) }
  },
  readJson: async (req: Request) => req.json(),
  HttpError: class extends Error {
    status: number; code: string
    constructor(status: number, code: string) { super(code); this.status = status; this.code = code }
  },
}))
vi.mock('@/lib/pusher-server', () => ({
  getPusherServer: vi.fn(() => null),
  roomChannel: vi.fn(() => 'private-room-room-1'),
}))

function makeReq(body: any) {
  return new Request('http://localhost/api/agent/message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domainId: 'domain-1', ...body }),
  })
}

describe('agent message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ success: true })
    mockFindUnique.mockResolvedValue({
      id: 'room-1',
      domainId: 'domain-1',
      status: 'LIVE',
      assignedToUserId: 'agent-1',
    })
    mockCreate.mockResolvedValue({ id: 'msg-1', message: 'Hello', senderType: 'AGENT', createdAt: new Date() })
    mockUpdate.mockResolvedValue({})
  })

  it('sends a message as AGENT (sender type forced, not from client)', async () => {
    const { POST } = await import('@/app/api/agent/message/route')
    const res = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1', content: 'Hello visitor', senderType: 'VISITOR' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    // senderType forced to AGENT regardless of client-supplied value
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ senderType: 'AGENT', senderUserId: 'agent-1', chatRoomId: 'room-1' }),
      })
    )
  })

  it('rejects messaging a room not in this domain', async () => {
    mockFindUnique.mockResolvedValue({ id: 'room-1', domainId: 'other-domain', status: 'LIVE', assignedToUserId: 'agent-1' })
    const { POST } = await import('@/app/api/agent/message/route')
    const res = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1', content: 'Hello' }))
    expect(res.status).toBe(403)
  })

  it('rejects messaging a room not assigned to this agent', async () => {
    mockFindUnique.mockResolvedValue({ id: 'room-1', domainId: 'domain-1', status: 'LIVE', assignedToUserId: 'agent-2' })
    const { POST } = await import('@/app/api/agent/message/route')
    const res = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1', content: 'Hello' }))
    expect(res.status).toBe(403)
  })

  it('rejects messaging a room not active', async () => {
    mockFindUnique.mockResolvedValue({ id: 'room-1', domainId: 'domain-1', status: 'CLOSED', assignedToUserId: 'agent-1' })
    const { POST } = await import('@/app/api/agent/message/route')
    const res = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1', content: 'Hello' }))
    expect(res.status).toBe(409)
  })

  it('rejects rate limited requests', async () => {
    mockRateLimit.mockResolvedValue({ success: false })
    const { POST } = await import('@/app/api/agent/message/route')
    const res = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1', content: 'Hello' }))
    expect(res.status).toBe(429)
  })
})
