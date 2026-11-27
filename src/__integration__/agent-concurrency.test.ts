import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockUpdateMany = vi.fn()
const mockFindFirst = vi.fn()
const mockFindUnique = vi.fn()
const mockRateLimit = vi.fn().mockResolvedValue({ success: true })

vi.mock('@/lib/prisma', () => ({
  client: {
    chatRoom: {
      updateMany: mockUpdateMany,
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
    },
  },
}))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mockRateLimit, getClientIp: () => '1.2.3.4' }))
vi.mock('@/lib/auth', () => ({
  requireDomainAccess: vi.fn(() => Promise.resolve({ user: { id: 'agent-1' } })),
}))
vi.mock('@/lib/pusher-server', () => ({
  getPusherServer: vi.fn(() => null),
  roomChannel: vi.fn(() => 'private-room-room-1'),
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

function makeReq(body: any) {
  return new Request('http://localhost/api/agent/takeover', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('two-agent concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ success: true })
    mockFindFirst.mockResolvedValue({ id: 'room-1', domainId: 'domain-1', status: 'WAITING_AGENT', assignedToUserId: null })
  })

  it('only one agent can claim a room (atomic claim)', async () => {
    // Agent 1 succeeds
    mockUpdateMany.mockResolvedValueOnce({ count: 1 })
    const { POST } = await import('@/app/api/agent/takeover/route')
    const res1 = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1' }))
    expect(res1.status).toBe(200)

    // Agent 2 fails - room already assigned
    mockUpdateMany.mockResolvedValueOnce({ count: 0 })
    const res2 = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1' }))
    expect(res2.status).toBe(409)
    const json2 = await res2.json()
    expect(json2.error).toBe('TAKEOVER_CONFLICT')
  })

  it('atomic claim uses conditional update (WAITING_AGENT + unassigned)', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const { POST } = await import('@/app/api/agent/takeover/route')
    await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1' }))
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'room-1',
        domainId: 'domain-1',
        status: 'WAITING_AGENT',
        assignedToUserId: null,
      },
      data: expect.objectContaining({ status: 'LIVE', assignedToUserId: 'agent-1' }),
    })
  })

  it('rejects claiming a CLOSED room', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 })
    mockFindFirst.mockResolvedValue({ id: 'room-1', domainId: 'domain-1', status: 'CLOSED', assignedToUserId: null })
    const { POST } = await import('@/app/api/agent/takeover/route')
    const res = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1' }))
    expect(res.status).toBe(409)
  })

  it('rejects claiming a BOT room (not WAITING_AGENT)', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 })
    mockFindFirst.mockResolvedValue({ id: 'room-1', domainId: 'domain-1', status: 'BOT', assignedToUserId: null })
    const { POST } = await import('@/app/api/agent/takeover/route')
    const res = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1' }))
    expect(res.status).toBe(409)
  })

  it('rejects rate limited requests', async () => {
    mockRateLimit.mockResolvedValue({ success: false })
    const { POST } = await import('@/app/api/agent/takeover/route')
    const res = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1' }))
    expect(res.status).toBe(429)
  })
})
