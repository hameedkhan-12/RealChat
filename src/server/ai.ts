import 'server-only'
import { z } from 'zod'
import { getEnv } from '@/env'
import { logger } from '@/lib/logger'

export type GroundedAnswerInput = {
  question: string
  knowledge: Array<{ title: string; content: string }>
  locale: string
}

export type GroundedAnswer = {
  answer: string
  shouldEscalate: boolean
}

const GroundedAnswerSchema = z.object({
  answer: z.string().min(1).max(2000),
  shouldEscalate: z.boolean().default(false),
})

type AIProvider = {
  answerFromKnowledge(input: GroundedAnswerInput): Promise<GroundedAnswer>
}

function isConfigured(): boolean {
  const env = getEnv()
  return Boolean(env.AI_API_KEY && env.AI_BASE_URL && env.AI_MODEL)
}

export const aiProvider: AIProvider = {
  async answerFromKnowledge(input: GroundedAnswerInput): Promise<GroundedAnswer> {
    const env = getEnv()
    if (!isConfigured()) {
      logger.info('ai provider not configured, returning fallback', {
        question: input.question.slice(0, 100),
      })
      return {
        answer: `I don't have confirmed information about that. A team member can help you.`,
        shouldEscalate: true,
      }
    }

    const knowledgeText = input.knowledge
      .map((k) => `- ${k.title}: ${k.content}`)
      .join('\n')

    const systemPrompt = `You are a helpful assistant for a real-estate company. Answer the visitor's question using ONLY the supplied knowledge below. Do not invent prices, availability, legal claims, delivery dates, or commitments. If the answer is not supported by the knowledge, say you do not have confirmed information and offer to connect the visitor with a human. Keep answers short and friendly.

Knowledge:
${knowledgeText || '(none available)'}`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input.question },
    ]

    const baseUrl = env.AI_BASE_URL!
    const apiKey = env.AI_API_KEY!
    const model = env.AI_MODEL!
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)

    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages,
          temperature: 0.2,
          max_tokens: 500,
        }),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        logger.error('ai provider returned error', {
          status: res.status,
          question: input.question.slice(0, 100),
        })
        return fallbackAnswer()
      }

      const data = await res.json()
      const raw = data.choices?.[0]?.message?.content ?? ''
      const parsed = GroundedAnswerSchema.safeParse(JSON.parse(raw))
      if (!parsed.success) {
        logger.error('ai provider output validation failed', {
          error: parsed.error.flatten().fieldErrors,
          question: input.question.slice(0, 100),
        })
        return fallbackAnswer()
      }
      return parsed.data
    } catch (e) {
      clearTimeout(timer)
      logger.error('ai provider call failed', {
        error: e instanceof Error ? e.message : String(e),
        question: input.question.slice(0, 100),
      })
      return fallbackAnswer()
    }
  },
}

function fallbackAnswer(): GroundedAnswer {
  return {
    answer: `I don't have confirmed information about that. A team member can help you.`,
    shouldEscalate: true,
  }
}
