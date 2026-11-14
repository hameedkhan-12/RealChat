import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockUpdateMany = vi.fn()
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockRateLimit = vi.fn().mockResolvedValue({ success: true })

vi.mock('@/lib/prisma', () => ({
  client: {
    chatRoom: {
      updateMany: mockUpdateMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
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

describe('agent takeover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ success: true })
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockFindUnique.mockResolvedValue({ id: 'room-1', status: 'LIVE', assignedToUserId: 'agent-1' })
  })

  it('atomically claims an unassigned BOT room', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const { POST } = await import('@/app/api/agent/takeover/route')
    const res = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1' }))
    expect(res.status).toBe(200)
    // updateMany called with domainId + status filter + unassigned check
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'room-1',
        domainId: 'domain-1',
        status: { in: ['BOT', 'WAITING_AGENT'] },
        assignedToUserId: null,
      },
      data: expect.objectContaining({ status: 'LIVE', assignedToUserId: 'agent-1' }),
    })
  })

  it('rejects claiming an already-assigned room', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 })
    const { POST } = await import('@/app/api/agent/takeover/route')
    const res = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1' }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('ROOM_NOT_CLAIMABLE')
  })

  it('rejects missing domainId', async () => {
    const { POST } = await import('@/app/api/agent/takeover/route')
    const res = await POST(makeReq({ chatRoomId: 'room-1' }))
    expect(res.status).toBe(400)
  })

  it('rejects rate limited requests', async () => {
    mockRateLimit.mockResolvedValue({ success: false })
    const { POST } = await import('@/app/api/agent/takeover/route')
    const res = await POST(makeReq({ domainId: 'domain-1', chatRoomId: 'room-1' }))
    expect(res.status).toBe(429)
  })
})
