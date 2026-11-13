import { describe, it, expect } from 'vitest'
import { contrastRatio, relativeLuminance, parseHex, passesWCAGAA, suggestTextColor } from '@/lib/contrast'

describe('contrast utilities', () => {
  describe('parseHex', () => {
    it('parses 3-digit hex', () => {
      const result = parseHex('#f00')
      expect(result).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })
    it('parses 6-digit hex', () => {
      const result = parseHex('#ff0000')
      expect(result).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })
    it('parses 8-digit hex', () => {
      const result = parseHex('#ff000080')!
      expect(result.r).toBe(255)
      expect(result.g).toBe(0)
      expect(result.b).toBe(0)
      expect(result.a).toBeCloseTo(0.5, 2)
    })
    it('returns null for invalid', () => {
      expect(parseHex('#xyz')).toBeNull()
      expect(parseHex('')).toBeNull()
    })
  })

  describe('relativeLuminance', () => {
    it('returns 1 for white', () => {
      expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 2)
    })
    it('returns 0 for black', () => {
      expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0, 2)
    })
  })

  describe('contrastRatio', () => {
    it('returns 21 for black on white', () => {
      expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    })
    it('returns 1 for same colors', () => {
      expect(contrastRatio('#ff0000', '#ff0000')).toBe(1)
    })
    it('returns null for invalid', () => {
      expect(contrastRatio('#xyz', '#000000')).toBeNull()
    })
  })

  describe('passesWCAGAA', () => {
    it('passes for black on white (normal text)', () => {
      expect(passesWCAGAA('#000000', '#ffffff', false)).toBe(true)
    })
    it('fails for gray on white (normal text)', () => {
      expect(passesWCAGAA('#777777', '#ffffff', false)).toBe(false)
    })
    it('passes for gray on white (large text)', () => {
      expect(passesWCAGAA('#777777', '#ffffff', true)).toBe(true)
    })
    it('returns null for invalid', () => {
      expect(passesWCAGAA('#xyz', '#000000')).toBeNull()
    })
  })

  describe('suggestTextColor', () => {
    it('returns black for light background', () => {
      expect(suggestTextColor('#ffffff')).toBe('black')
    })
    it('returns white for dark background', () => {
      expect(suggestTextColor('#000000')).toBe('white')
    })
  })
})
