import { describe, it, expect, beforeEach, vi } from 'vitest'
import { currentUser } from '@clerk/nextjs/server'
import { client } from '@/lib/prisma'

const mockFindUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({
  client: {
    chatRoom: { findUnique: mockFindUnique },
    domainMember: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))
vi.mock('@/env', () => ({
  getEnv: vi.fn(() => ({
    PUSHER_APP_ID: 'app-1',
    PUSHER_KEY: 'key-1',
    PUSHER_SECRET: 'secret-1',
    PUSHER_CLUSTER: 'cl-1',
  })),
}))

function makeFormReq(socketId: string, channelName: string, token?: string): Request {
  const body = `socket_id=${encodeURIComponent(socketId)}&channel_name=${encodeURIComponent(channelName)}`
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' }
  if (token) headers['authorization'] = `Bearer ${token}`
  return new Request('http://localhost/api/pusher/auth', { method: 'POST', headers, body })
}

describe('pusher auth route', () => {
  let POST: (req: Request) => Promise<Response>
  beforeEach(async () => {
    mockFindUnique.mockReset()
    vi.mocked(currentUser).mockResolvedValue(null)
    const mod = await import('@/app/api/pusher/auth/route')
    POST = mod.POST
  })

  it('authorizes widget visitor for their own room channel', async () => {
    mockFindUnique.mockResolvedValue({ id: 'room-1', domainId: 'd-1' })
    const res = await POST(makeFormReq('socket-1', 'private-room-room-1', 'token'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.auth).toContain(':')
  })

  it('rejects widget visitor for another room channel', async () => {
    mockFindUnique.mockResolvedValue({ id: 'room-1', domainId: 'd-1' })
    const res = await POST(makeFormReq('socket-1', 'private-room-room-2', 'token'))
    expect(res.status).toBe(403)
  })

  it('rejects missing socket_id/channel', async () => {
    const res = await POST(new Request('http://localhost/api/pusher/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'socket_id=socket-1',
    }))
    expect(res.status).toBe(400)
  })
})
