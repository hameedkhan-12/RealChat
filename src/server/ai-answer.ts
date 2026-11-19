import 'server-only'
import { z } from 'zod'
import { aiProvider } from '@/server/ai'
import { logger } from '@/lib/logger'
import type { KnowledgeCandidate } from '@/server/knowledge-retrieval'

export type GenerateAnswerInput = {
  question: string
  knowledge: KnowledgeCandidate[]
}

export type GenerateAnswerResult = {
  answer: string
  canAnswer: boolean
  usedKnowledgeIds: string[]
  abstainReason: AbstainReason | null
}

export type AbstainReason =
  | 'NO_RELEVANT_KNOWLEDGE'
  | 'INSUFFICIENT_CONTEXT'
  | 'CONFLICTING_INFORMATION'
  | 'PROVIDER_ERROR'
  | 'INVALID_OUTPUT'
  | null

const GenerateAnswerSchema = z.object({
  answer: z.string().min(1).max(2000),
  canAnswer: z.boolean().default(false),
  usedKnowledgeIds: z.array(z.string()).default([]),
  abstainReason: z
    .enum(['NO_RELEVANT_KNOWLEDGE', 'INSUFFICIENT_CONTEXT', 'CONFLICTING_INFORMATION', 'PROVIDER_ERROR', 'INVALID_OUTPUT'])
    .nullable()
    .default(null),
})

/** System prompt for the AI answer service. */
const SYSTEM_PROMPT = `You are a helpful assistant for a real-estate company. Answer the visitor's question using ONLY the supplied knowledge below. Do not invent prices, availability, legal claims, delivery dates, or commitments. If the answer is not supported by the knowledge, say you do not have confirmed information and offer to connect the visitor with a human. Keep answers short and friendly.

Knowledge:
{knowledge_text}`

/** Maximum characters of knowledge context to pass to the model. */
const MAX_CONTEXT_CHARS = 4000

/**
 * Truncate knowledge context to fit within the character limit while preserving
 * as many complete items as possible.
 */
function truncateKnowledge(
  knowledge: KnowledgeCandidate[],
  maxChars: number
): { selected: KnowledgeCandidate[]; totalChars: number } {
  const selected: KnowledgeCandidate[] = []
  let totalChars = 0

  for (const item of knowledge) {
    const itemText = `${item.title}: ${item.content}\n`
    if (totalChars + itemText.length > maxChars && selected.length > 0) {
      break
    }
    selected.push(item)
    totalChars += itemText.length
  }

  return { selected, totalChars }
}

/**
 * Generate a grounded answer to a visitor question using only the supplied knowledge.
 * Never invent information not present in the knowledge.
 */
export async function generateGroundedAnswer(
  input: GenerateAnswerInput
): Promise<GenerateAnswerResult> {
  const { question, knowledge } = input

  if (knowledge.length === 0) {
    return {
      answer: `I don't have confirmed information about that. A team member can help you.`,
      canAnswer: false,
      usedKnowledgeIds: [],
      abstainReason: 'NO_RELEVANT_KNOWLEDGE',
    }
  }

  const { selected } = truncateKnowledge(knowledge, MAX_CONTEXT_CHARS)

  const knowledgeText = selected
    .map((k) => `- ${k.title}: ${k.content}`)
    .join('\n')

  const systemPrompt = SYSTEM_PROMPT.replace('{knowledge_text}', knowledgeText || '(none available)')

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ]

  let result: GenerateAnswerResult

  try {
    const grounded = await aiProvider.answerFromKnowledge({
      question,
      knowledge: selected,
      locale: 'en',
    })

    // aiProvider returns shouldEscalate=true when it cannot answer from knowledge.
    // canAnswer is the inverse.
    const canAnswer = !grounded.shouldEscalate

    return {
      answer: grounded.answer,
      canAnswer,
      usedKnowledgeIds: selected.map((k) => k.id),
      abstainReason: grounded.shouldEscalate ? 'INSUFFICIENT_CONTEXT' : null,
    }
  } catch (e) {
    logger.error('ai answer generation failed', {
      error: e instanceof Error ? e.message : String(e),
      question: question.slice(0, 100),
    })
    return {
      answer: `I don't have confirmed information about that. A team member can help you.`,
      canAnswer: false,
      usedKnowledgeIds: [],
      abstainReason: 'PROVIDER_ERROR',
    }
  }

  return result
}
