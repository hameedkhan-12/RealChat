import { describe, it, expect, vi, beforeEach } from 'vitest'
import { client } from '@/lib/prisma'
import { retrieveKnowledge } from '@/server/knowledge-retrieval'

vi.mock('@/lib/prisma', () => ({
  client: {
    knowledgeItem: {
      findMany: vi.fn(),
    },
  },
}))

function mockKnowledgeItems(items: Array<{ id: string; title: string; content: string; domainId: string; isActive: boolean }>) {
  ;(client.knowledgeItem.findMany as any).mockResolvedValue(items)
}

describe('retrieveKnowledge - tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('only returns items for the requested domain', async () => {
    mockKnowledgeItems([
      { id: '1', title: 'A', content: 'apartments', domainId: 'domain-a', isActive: true },
      { id: '2', title: 'B', content: 'villas', domainId: 'domain-b', isActive: true },
    ])

    const result = await retrieveKnowledge({ domainId: 'domain-a', question: 'apartments' })
    expect(result.candidates.length).toBe(1)
    expect(result.candidates[0].id).toBe('1')
  })

  it('excludes inactive knowledge items', async () => {
    mockKnowledgeItems([
      { id: '1', title: 'A', content: 'apartments', domainId: 'domain-a', isActive: true },
      { id: '2', title: 'B', content: 'villas', domainId: 'domain-a', isActive: false },
    ])

    const result = await retrieveKnowledge({ domainId: 'domain-a', question: 'apartments' })
    expect(result.candidates.length).toBe(1)
    expect(result.candidates[0].id).toBe('1')
  })

  it('returns empty array when no knowledge items exist', async () => {
    mockKnowledgeItems([])
    const result = await retrieveKnowledge({ domainId: 'domain-a', question: 'apartments' })
    expect(result.candidates.length).toBe(0)
    expect(result.sufficientContext).toBe(false)
  })

  it('returns sufficientContext true when knowledge items found', async () => {
    mockKnowledgeItems([
      { id: '1', title: 'A', content: 'apartments', domainId: 'domain-a', isActive: true },
    ])
    const result = await retrieveKnowledge({ domainId: 'domain-a', question: 'apartments' })
    expect(result.sufficientContext).toBe(true)
  })

  it('returns sufficientContext false when no knowledge items found', async () => {
    mockKnowledgeItems([])
    const result = await retrieveKnowledge({ domainId: 'domain-a', question: 'apartments' })
    expect(result.sufficientContext).toBe(false)
  })
})
