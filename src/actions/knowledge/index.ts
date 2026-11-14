'use server'

import { client } from '@/lib/prisma'
import { requireDomainAccess } from '@/lib/auth'
import { action } from '@/lib/action'
import { logger } from '@/lib/logger'
import { z } from 'zod'

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
  return action(async () => {
    await requireDomainAccess(domainId)
    const items = await client.knowledgeItem.findMany({
      where: { domainId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, content: true, category: true, isActive: true, createdAt: true, updatedAt: true },
    })
    return { ok: true, data: { items } }
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
