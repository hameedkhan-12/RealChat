import { describe, it, expect } from 'vitest'
import { rankKnowledgeByRelevance } from '@/app/api/widget/message/route'

describe('rankKnowledgeByRelevance', () => {
  it('ranks items with more keyword matches higher', () => {
    const items = [
      { id: '1', title: 'Apartments', content: 'We have luxury apartments for rent.' },
      { id: '2', title: 'Villas', content: 'Luxury apartments for purchase.' },
      { id: '3', title: 'Contact', content: 'Call us at 555-1234.' },
    ]
    const result = rankKnowledgeByRelevance('apartments rent', items)
    expect(result[0].id).toBe('1') // "apartments" + "rent" = 2 matches
    expect(result[1].id).toBe('2') // "apartments" = 1 match
    expect(result.length).toBe(2) // item 3 has 0 matches, filtered out
  })

  it('filters out items with zero matches', () => {
    const items = [
      { id: '1', title: 'Apartments', content: 'We have luxury apartments.' },
      { id: '2', title: 'Contact', content: 'Call us at 555-1234.' },
    ]
    const result = rankKnowledgeByRelevance('villas purchase', items)
    expect(result.length).toBe(0)
  })

  it('returns all items when question is too short', () => {
    const items = [{ id: '1', title: 'Apartments', content: 'We have apartments.' }]
    const result = rankKnowledgeByRelevance('hi', items)
    expect(result.length).toBe(1)
  })

  it('handles empty items', () => {
    const result = rankKnowledgeByRelevance('anything', [])
    expect(result.length).toBe(0)
  })
})
