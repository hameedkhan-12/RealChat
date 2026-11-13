import { describe, it, expect } from 'vitest'
import { EmailSchema, NameSchema, PhoneSchema, IanaTimezoneSchema, isHexColor, isHttpsUrl } from '@/lib/validation'

describe('EmailSchema', () => {
  it('lowercases and trims', () => {
    expect(EmailSchema.parse('  User@Example.COM ')).toBe('user@example.com')
  })

  it('rejects invalid email', () => {
    expect(() => EmailSchema.parse('not-an-email')).toThrow()
  })
})

describe('NameSchema', () => {
  it('trims and enforces length', () => {
    expect(NameSchema.parse('  Ada  ')).toBe('Ada')
    expect(() => NameSchema.parse('')).toThrow()
  })
})

describe('PhoneSchema', () => {
  it('normalises punctuation', () => {
    expect(PhoneSchema.parse('+1 (555) 123-4567')).toBe('+15551234567')
  })

  it('rejects short/invalid phones', () => {
    expect(() => PhoneSchema.parse('123')).toThrow()
  })
})

describe('IanaTimezoneSchema', () => {
  it('accepts valid IANA zones', () => {
    expect(IanaTimezoneSchema.parse('America/Los_Angeles')).toBe('America/Los_Angeles')
  })

  it('rejects bogus zones', () => {
    expect(() => IanaTimezoneSchema.parse('Not/AZone')).toThrow()
  })
})

describe('isHexColor', () => {
  it('accepts 3 and 6 digit hex', () => {
    expect(isHexColor('#fff')).toBe(true)
    expect(isHexColor('#ff5733')).toBe(true)
  })

  it('rejects invalid and accepts null/undefined', () => {
    expect(isHexColor('#ggg')).toBe(false)
    expect(isHexColor(null)).toBe(true)
    expect(isHexColor(undefined)).toBe(true)
  })
})

describe('isHttpsUrl', () => {
  it('accepts https and rejects http', () => {
    expect(isHttpsUrl('https://a.com')).toBe(true)
    expect(isHttpsUrl('http://a.com')).toBe(false)
    expect(isHttpsUrl(null)).toBe(true)
  })
})
