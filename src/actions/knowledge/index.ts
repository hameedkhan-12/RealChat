'use server'

import { client } from '@/lib/prisma'
import { requireDomainAccess } from '@/lib/auth'
import { action } from '@/lib/action'
import { logger } from '@/lib/logger'
import { z } from 'zod'

/**
 * KnowledgeItem vs HelpDesk relationship (documented per R8 acceptance):
 *
 * KnowledgeItem is the CANONICAL source for AI knowledge retrieval.
 *   - Used by retrieveKnowledge() in src/server/knowledge-retrieval.ts
   *   - Used by generateGroundedAnswer() in src/server/ai-answer.ts
   *   - Managed via onUpsertKnowledgeItem / onDeleteKnowledgeItem below
   *   - Tenant-scoped, isActive flag controls visibility
 *
 * HelpDesk is a SEPARATE FAQ model (src/prisma/schema.prisma HelpDesk).
 *   - NOT used by AI retrieval; serves as a standalone dashboard FAQ.
 *   - No write path to/from KnowledgeItem exists by design.
 *   - Future work: either migrate HelpDesk items into KnowledgeItem or
   *   remove HelpDesk to avoid duplicate stores.
 *
 * Do not read from both stores in AI paths. Use KnowledgeItem exclusively
 * for AI answer generation.
 */

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; issues?: { path: string; message: string }[] }

const KnowledgeItemInput = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(10000),
  category: z.string().trim().max(100).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const onGetKnowledgeItems = async (domainId: string): Promise<ActionResult> => {
  console.log('onGetKnowledgeItems called with domainId:', domainId)
  return action(async () => {
    await requireDomainAccess(domainId)
    const items = await client.knowledgeItem.findMany({
      where: { domainId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, content: true, category: true, isActive: true, createdAt: true, updatedAt: true },
    })
    console.log('knowledge items found:', items.length)
    return { items }
  })
}

export const onUpsertKnowledgeItem = async (
  domainId: string,
  itemId: string | null,
  input: { title: string; content: string; category?: string | null; isActive: boolean }
): Promise<ActionResult> => {
  return action(async () => {
    await requireDomainAccess(domainId, 'OWNER')
    const parsed = KnowledgeItemInput.parse(input)
    if (itemId) {
      const existing = await client.knowledgeItem.findFirst({ where: { id: itemId, domainId } })
      if (!existing) return { ok: false, error: 'FORBIDDEN', status: 403 }
      const item = await client.knowledgeItem.update({
        where: { id: itemId },
        data: { title: parsed.title, content: parsed.content, category: parsed.category ?? null, isActive: parsed.isActive },
      })
      return { ok: true, data: { item } }
    } else {
      const item = await client.knowledgeItem.create({
        data: { domainId, title: parsed.title, content: parsed.content, category: parsed.category ?? null, isActive: parsed.isActive },
      })
      return { ok: true, data: { item } }
    }
  })
}

export const onDeleteKnowledgeItem = async (domainId: string, itemId: string): Promise<ActionResult> => {
  return action(async () => {
    await requireDomainAccess(domainId, 'OWNER')
    const existing = await client.knowledgeItem.findFirst({ where: { id: itemId, domainId } })
    if (!existing) return { ok: false, error: 'FORBIDDEN', status: 403 }
    await client.knowledgeItem.delete({ where: { id: itemId } })
    return { ok: true, data: { id: itemId } }
  })
}
