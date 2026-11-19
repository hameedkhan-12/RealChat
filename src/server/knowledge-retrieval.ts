import 'server-only'
import { client } from '@/lib/prisma'

export type KnowledgeCandidate = {
  id: string
  title: string
  content: string
  score: number
}

export type RetrievalResult = {
  candidates: KnowledgeCandidate[]
  sufficientContext: boolean
}

export type RetrievalInput = {
  domainId: string
  question: string
}

/** Maximum number of knowledge items to retrieve per query. */
const MAX_RETRIEVED = 5

/** Maximum total characters of knowledge context to pass to the model. */
const MAX_CONTEXT_CHARS = 4000

/** Minimum relevance score for a knowledge item to be considered relevant. */
const MIN_RELEVANCE_SCORE = 1

/** Tokenize a question into meaningful words. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length > 2)
}

/** Score a knowledge item against a question using keyword matching. */
function scoreItem(questionWords: string[], item: { title: string; content: string }): number {
  const text = `${item.title} ${item.content}`.toLowerCase()
  return questionWords.filter((w) => text.includes(w)).length
}

/** Rank knowledge items by keyword relevance to the question. */
export function rankKnowledgeByRelevance(
  question: string,
  items: Array<{ id: string; title: string; content: string }>
): KnowledgeCandidate[] {
  const qWords = tokenize(question)
  if (qWords.length === 0) {
    // No meaningful question words - return all items unranked
    return items.map((item) => ({ ...item, score: 0 }))
  }

  return items
    .map((item) => ({
      item,
      score: scoreItem(qWords, item),
    }))
    .filter((x) => x.score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .map((x) => ({ ...x.item, score: x.score }))
}

/**
 * Retrieve active knowledge items for a domain, ranked by relevance to the question.
 * All queries are scoped to the tenant's domainId to prevent cross-tenant data leakage.
 * Only active (isActive=true) items are returned.
 */
export async function retrieveKnowledge(input: RetrievalInput): Promise<RetrievalResult> {
  const items = await client.knowledgeItem.findMany({
    where: {
      domainId: input.domainId,
      isActive: true,
    },
    select: { id: true, title: true, content: true },
    take: MAX_RETRIEVED,
    orderBy: { updatedAt: 'desc' },
  })

  const ranked = rankKnowledgeByRelevance(input.question, items)

  const sufficientContext = ranked.length > 0

  return {
    candidates: ranked,
    sufficientContext,
  }
}
