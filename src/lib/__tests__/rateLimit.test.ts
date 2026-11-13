import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rateLimit } from '@/lib/rate-limit'

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}))

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
    // First 5 requests allowed
    for (let i = 0; i < 5; i++) {
      const r = await rateLimit('user-2', 5, 60)
      expect(r.success).toBe(true)
    }
    // 6th should be blocked
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
