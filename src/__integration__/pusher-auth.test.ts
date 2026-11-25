import { describe, it, expect, beforeEach, vi } from 'vitest'
import { currentUser } from '@clerk/nextjs/server'
import { client } from '@/lib/prisma'
import { requireWidgetSession } from '@/lib/widget-auth'
import { HttpError } from '@/lib/http'

vi.mock('@/lib/prisma', () => ({
  client: {
    chatRoom: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    domainMember: { findUnique: vi.fn() },
  },
}))
vi.mock('@/env', () => ({
  getEnv: vi.fn(() => ({ PUSHER_APP_ID: 'app-1', PUSHER_KEY: 'key-1', PUSHER_SECRET: 'secret-1', PUSHER_CLUSTER: 'cl-1' })),
}))
vi.mock('@/lib/pusher-server', () => ({
  getPusherServer: vi.fn(() => null),
  roomChannel: vi.fn(() => 'private-room-room-1'),
  pusherAuthSignature: vi.fn(() => 'sig-1'),
}))
vi.mock('@/lib/widget-auth', () => ({
  requireWidgetSession: vi.fn(),
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

function makeReq(socketId: string, channelName: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/pusher/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
  })
}

describe('pusher auth route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(currentUser).mockResolvedValue(null)
  })

  it('authorizes widget visitor for their own room channel', async () => {
    vi.mocked(requireWidgetSession).mockResolvedValue({ room: { id: 'room-1', domainId: 'd-1' } } as any)
    const { POST } = await import('@/app/api/pusher/auth/route')
    const res = await POST(makeReq('socket-1', 'private-room-room-1', { authorization: 'Bearer token' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.auth).toContain(':')
  })

  it('rejects widget visitor for another room channel', async () => {
    vi.mocked(requireWidgetSession).mockResolvedValue({ room: { id: 'room-1', domainId: 'd-1' } } as any)
    const { POST } = await import('@/app/api/pusher/auth/route')
    const res = await POST(makeReq('socket-1', 'private-room-room-2', { authorization: 'Bearer token' }))
    expect(res.status).toBe(403)
  })

  it('rejects unknown channel patterns', async () => {
    vi.mocked(requireWidgetSession).mockResolvedValue({ room: { id: 'room-1', domainId: 'd-1' } } as any)
    const { POST } = await import('@/app/api/pusher/auth/route')
    const res = await POST(makeReq('socket-1', 'private-other-room-1', { authorization: 'Bearer token' }))
    expect(res.status).toBe(403)
  })

  it('rejects invalid widget session', async () => {
    vi.mocked(requireWidgetSession).mockRejectedValue(new HttpError(401, 'INVALID_SESSION'))
    const { POST } = await import('@/app/api/pusher/auth/route')
    const res = await POST(makeReq('socket-1', 'private-room-room-1', { authorization: 'Bearer token' }))
    expect(res.status).toBe(401)
  })

  it('authorizes clerk agent for a domain channel they belong to', async () => {
    vi.mocked(currentUser).mockResolvedValue({ id: 'clerk-agent-1' } as any)
    vi.mocked(client.user.findUnique).mockResolvedValue({ id: 'user-1', clerkId: 'clerk-agent-1' } as any)
    vi.mocked(client.domainMember.findUnique).mockResolvedValue({ id: 'm-1', domainId: 'd-1', userId: 'user-1', role: 'AGENT' } as any)
    const { POST } = await import('@/app/api/pusher/auth/route')
    const res = await POST(makeReq('socket-1', 'private-domain-d-1'))
    expect(res.status).toBe(200)
  })

  it('rejects clerk agent for a room channel in another tenant', async () => {
    vi.mocked(currentUser).mockResolvedValue({ id: 'clerk-agent-1' } as any)
    vi.mocked(client.user.findUnique).mockResolvedValue({ id: 'user-1', clerkId: 'clerk-agent-1' } as any)
    vi.mocked(client.chatRoom.findUnique).mockResolvedValue({ id: 'room-1', domainId: 'other-domain' } as any)
    vi.mocked(client.domainMember.findUnique).mockResolvedValue(null)
    const { POST } = await import('@/app/api/pusher/auth/route')
    const res = await POST(makeReq('socket-1', 'private-room-room-1'))
    expect(res.status).toBe(403)
  })

  it('rejects unknown channel for clerk agent', async () => {
    vi.mocked(currentUser).mockResolvedValue({ id: 'clerk-agent-1' } as any)
    vi.mocked(client.user.findUnique).mockResolvedValue({ id: 'user-1', clerkId: 'clerk-agent-1' } as any)
    const { POST } = await import('@/app/api/pusher/auth/route')
    const res = await POST(makeReq('socket-1', 'private-unknown-xyz'))
    expect(res.status).toBe(403)
  })

  it('rejects unauthenticated agent with no session', async () => {
    const { POST } = await import('@/app/api/pusher/auth/route')
    const res = await POST(makeReq('socket-1', 'private-domain-d-1'))
    expect(res.status).toBe(401)
  })
})
