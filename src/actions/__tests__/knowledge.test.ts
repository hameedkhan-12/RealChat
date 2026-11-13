import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => {
  const mockClient: any = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    domain: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    domainMember: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    knowledgeItem: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(async (cb) => cb({})),
  }
  return { client: mockClient }
})

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(() => Promise.resolve(null)),
  clerkClient: vi.fn(() => Promise.resolve({ users: { updateUser: vi.fn() } })),
}))

import { client } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

function setMember(domainId: string, userId = 'user-1', role = 'OWNER') {
  ;(client.domainMember.findUnique as any).mockResolvedValue({ id: 'm-1', domainId, userId, role })
}
function setUser() {
  ;(client.user.findUnique as any).mockResolvedValue({
    id: 'user-1',
    memberships: [{ domain: { name: 'Domain A', id: 'domain-a' } }],
  })
  ;(currentUser as any).mockResolvedValue({ id: 'user-1', email: 'test@test.com' })
}

describe('knowledge tenant isolation', () => {
  beforeEach(() => {
    setUser()
  })

  it('onGetKnowledgeItems scopes query to authorized domainId', async () => {
    setMember('domain-a')
    ;(client.knowledgeItem.findMany as any).mockResolvedValue([])

    const { onGetKnowledgeItems } = await import('@/actions/knowledge')
    const result = await onGetKnowledgeItems('domain-a')
    expect(result?.ok).toBe(true)
    expect(client.knowledgeItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ domainId: 'domain-a' }) })
    )
  })

  it('onUpsertKnowledgeItem scopes lookup to authorized domainId', async () => {
    setMember('domain-a')
    ;(client.knowledgeItem.findFirst as any).mockImplementation(async () => null)
    ;(client.knowledgeItem.update as any).mockResolvedValue({})

    const { onUpsertKnowledgeItem } = await import('@/actions/knowledge')
    await onUpsertKnowledgeItem('domain-a', 'item-other-domain', {
      title: 'x', content: 'y', isActive: true,
    })
    // The lookup must include domainId, proving tenant scoping (IDOR protection)
    expect(client.knowledgeItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ domainId: 'domain-a', id: 'item-other-domain' }) })
    )
    expect(client.knowledgeItem.update).not.toHaveBeenCalled()
  })

  it('onDeleteKnowledgeItem scopes lookup to authorized domainId', async () => {
    setMember('domain-a')
    ;(client.knowledgeItem.findFirst as any).mockImplementation(async () => null)

    const { onDeleteKnowledgeItem } = await import('@/actions/knowledge')
    await onDeleteKnowledgeItem('domain-a', 'item-other-domain')
    // The lookup must include domainId, proving tenant scoping (IDOR protection)
    expect(client.knowledgeItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ domainId: 'domain-a', id: 'item-other-domain' }) })
    )
  })

  it('onUpsertKnowledgeItem creates item scoped to domainId', async () => {
    setMember('domain-a')
    ;(client.knowledgeItem.create as any).mockResolvedValue({ id: 'item-1', domainId: 'domain-a' })

    const { onUpsertKnowledgeItem } = await import('@/actions/knowledge')
    const result = await onUpsertKnowledgeItem('domain-a', null, {
      title: 'FAQ', content: 'Answer', category: 'Pricing', isActive: true,
    })
    expect((result as any)?.ok).toBe(true)
    expect(client.knowledgeItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ domainId: 'domain-a' }) })
    )
  })
})
