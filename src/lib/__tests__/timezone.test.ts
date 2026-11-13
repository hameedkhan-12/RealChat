import { describe, it, expect } from 'vitest'
import {
  getTimezoneOffsetMinutes,
  getLocalDateParts,
  localToUTC,
  addMinutes,
  formatLocalDate,
  formatLocalTime,
  isSameDay,
} from '@/lib/timezone'

describe('timezone utilities', () => {
  describe('getTimezoneOffsetMinutes', () => {
    it('returns 0 for UTC', () => {
      const jan = new Date(Date.UTC(2026, 0, 15, 12, 0, 0))
      expect(getTimezoneOffsetMinutes('UTC', jan)).toBe(0)
    })
    it('returns positive offset for ahead timezones', () => {
      const jan = new Date(Date.UTC(2026, 0, 15, 12, 0, 0))
      const dubai = getTimezoneOffsetMinutes('Asia/Dubai', jan)
      expect(dubai).toBe(4 * 60) // UTC+4
    })
  })

  describe('getLocalDateParts', () => {
    it('converts UTC to local parts', () => {
      const utc = new Date(Date.UTC(2026, 5, 15, 12, 0, 0)) // June 15, 12:00 UTC
      const parts = getLocalDateParts('America/New_York', utc)
      // New York is UTC-4 in June (EDT), so local time is 08:00
      expect(parts.hour).toBe(8)
      expect(parts.day).toBe(15)
    })
  })

  describe('localToUTC', () => {
    it('converts local time back to UTC', () => {
      const local = new Date(Date.UTC(2026, 5, 15, 8, 0, 0)) // 08:00 local NY = 12:00 UTC
      const utc = localToUTC('America/New_York', 2026, 5, 15, 8, 0)
      expect(utc.getUTCHours()).toBe(12)
    })

    it('handles DST spring-forward: LA 09:00 on 2026-03-08 is 16:00Z not 17:00Z', () => {
      // 2026-03-08 is the US spring-forward day; 09:00 LA local = PDT (UTC-7) = 16:00 UTC
      const utc = localToUTC('America/Los_Angeles', 2026, 2, 8, 9, 0)
      expect(utc.getUTCHours()).toBe(16)
      expect(utc.getUTCDate()).toBe(8)
    })
  })

  describe('addMinutes', () => {
    it('adds minutes correctly', () => {
      const d = new Date(Date.UTC(2026, 0, 1, 12, 0, 0))
      const result = addMinutes(d, 30)
      expect(result.getUTCMinutes()).toBe(30)
    })
  })

  describe('formatLocalDate', () => {
    it('formats date in local timezone', () => {
      const utc = new Date(Date.UTC(2026, 5, 15, 3, 0, 0)) // June 15, 03:00 UTC
      const ny = formatLocalDate('America/New_York', utc) // June 14, 23:00 EDT
      expect(ny).toBe('2026-06-14')
    })
  })

  describe('isSameDay', () => {
    it('returns true for same day', () => {
      const utc = new Date(Date.UTC(2026, 5, 15, 12, 0, 0))
      const later = new Date(Date.UTC(2026, 5, 15, 18, 0, 0))
      expect(isSameDay('UTC', utc, later)).toBe(true)
    })
    it('returns false for different days', () => {
      const utc1 = new Date(Date.UTC(2026, 5, 15, 23, 0, 0))
      const utc2 = new Date(Date.UTC(2026, 5, 16, 1, 0, 0))
      expect(isSameDay('UTC', utc1, utc2)).toBe(false)
    })
  })
})
