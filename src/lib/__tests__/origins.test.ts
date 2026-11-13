import { describe, it, expect, vi } from 'vitest'
import { normalizeOrigin, normalizeOrigins } from '@/lib/origins'

describe('normalizeOrigin', () => {
  it('returns https origin without path', () => {
    expect(normalizeOrigin('https://example.com/path')).toBe('https://example.com')
  })

  it('rejects http origins', () => {
    expect(normalizeOrigin('http://example.com')).toBeNull()
  })

  it('allows http localhost outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(normalizeOrigin('http://localhost:5173')).toBe('http://localhost:5173')
    vi.unstubAllEnvs()
  })

  it('rejects garbage', () => {
    expect(normalizeOrigin('not-a-url')).toBeNull()
    expect(normalizeOrigin('')).toBeNull()
  })
})

describe('normalizeOrigins', () => {
  it('filters invalid and caps at max', () => {
    const out = normalizeOrigins(
      ['https://a.com', 'http://b.com', 'https://a.com', 'not-a-url', 'https://c.com'],
      2
    )
    expect(out).toEqual(['https://a.com', 'https://c.com'])
  })
})
