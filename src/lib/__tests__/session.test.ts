import { describe, it, expect } from 'vitest'
import { createSessionToken, hashToken, safeEqual } from '@/lib/session'

describe('session utilities', () => {
  describe('createSessionToken', () => {
    it('returns token and hash', () => {
      const result = createSessionToken()
      expect(result.token).toBeDefined()
      expect(result.hash).toBeDefined()
      expect(typeof result.token).toBe('string')
      expect(typeof result.hash).toBe('string')
      expect(result.token).toHaveLength(64) // 32 bytes hex = 64 chars
      expect(result.hash).toHaveLength(64) // SHA-256 hex = 64 chars
      expect(result.token).not.toBe(result.hash)
    })
    it('generates unique tokens', () => {
      const t1 = createSessionToken().token
      const t2 = createSessionToken().token
      expect(t1).not.toBe(t2)
    })
  })

  describe('hashToken', () => {
    it('hashes consistently', () => {
      const h1 = hashToken('test-token')
      const h2 = hashToken('test-token')
      expect(h1).toBe(h2)
    })
    it('produces different hashes for different inputs', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'))
    })
  })

  describe('safeEqual', () => {
    it('returns true for equal strings', () => {
      expect(safeEqual('abc', 'abc')).toBe(true)
    })
    it('returns false for different strings', () => {
      expect(safeEqual('abc', 'abd')).toBe(false)
    })
    it('returns false for different lengths', () => {
      expect(safeEqual('abc', 'abcd')).toBe(false)
    })
    it('returns false for empty vs non-empty', () => {
      expect(safeEqual('', 'a')).toBe(false)
      expect(safeEqual('a', '')).toBe(false)
    })
  })
})
