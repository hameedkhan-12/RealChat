import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}))

describe('getClientIp', () => {
  it('uses the rightmost proxy IP when TRUSTED_PROXY_COUNT=1', () => {
    const req = new Request('http://localhost/test', {
      headers: { 'x-forwarded-for': '6.6.6.6, 1.2.3.4' },
    })
    vi.stubEnv('TRUSTED_PROXY_COUNT', '1')
    expect(getClientIp(req)).toBe('1.2.3.4')
    vi.unstubAllEnvs()
  })

  it('falls back to x-real-ip', () => {
    const req = new Request('http://localhost/test', {
      headers: { 'x-real-ip': '9.9.9.9' },
    })
    expect(getClientIp(req)).toBe('9.9.9.9')
  })
})

describe('rateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows requests under limit', async () => {
    const result = await rateLimit('user-1', 5, 60)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks requests over limit', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await rateLimit('user-2', 5, 60)
      expect(r.success).toBe(true)
    }
    const r = await rateLimit('user-2', 5, 60)
    expect(r.success).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('tracks different keys independently', async () => {
    await rateLimit('user-a', 1, 60)
    const r1 = await rateLimit('user-a', 1, 60)
    expect(r1.success).toBe(false)

    const r2 = await rateLimit('user-b', 1, 60)
    expect(r2.success).toBe(true)
  })
})
