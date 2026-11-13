import { describe, it, expect } from 'vitest'
import { csvCell, csvRow } from '@/lib/csv'

describe('csvCell', () => {
  it('quotes a normal cell', () => {
    expect(csvCell('hello')).toBe('"hello"')
  })

  it('doubles embedded quotes', () => {
    expect(csvCell('she said "hi"')).toBe('"she said ""hi"""')
  })

  it('neutralizes formula injection prefixes', () => {
    expect(csvCell('=1+1')).toBe(`"'=1+1"`)
    expect(csvCell('+1+1')).toBe(`"'+1+1"`)
    expect(csvCell('-1+1')).toBe(`"'-1+1"`)
    expect(csvCell('@evil')).toBe(`"'@evil"`)
  })

  it('handles null/undefined', () => {
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
  })
})

describe('csvRow', () => {
  it('joins cells with commas', () => {
    expect(csvRow(['a', 'b', 'c'])).toBe('"a","b","c"')
  })
})
