import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getEnv } from '@/env'

vi.mock('@/env', () => ({
  getEnv: vi.fn(),
}))

import { aiProvider } from '@/server/ai'

const originalFetch = global.fetch

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  global.fetch = originalFetch
})

describe('aiProvider', () => {
  it('returns fallback when provider not configured', async () => {
    vi.mocked(getEnv).mockReturnValue({} as any)
    const result = await aiProvider.answerFromKnowledge({
      question: 'Do you have apartments?',
      knowledge: [],
      locale: 'en',
    })
    expect(result.shouldEscalate).toBe(true)
    expect(result.answer).toContain('team member')
  })

  it('returns structured answer when provider configured and responds', async () => {
    vi.mocked(getEnv).mockReturnValue({
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://api.example.com/v1',
      AI_MODEL: 'test-model',
    } as any)
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: JSON.stringify({ answer: 'We have villas.', shouldEscalate: false }) } }],
          }),
      }) as any
    )

    const result = await aiProvider.answerFromKnowledge({
      question: 'Any villas?',
      knowledge: [{ title: 'Villas', content: 'We have villas available.' }],
      locale: 'en',
    })
    expect(result.answer).toBe('We have villas.')
    expect(result.shouldEscalate).toBe(false)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('returns fallback on provider error', async () => {
    vi.mocked(getEnv).mockReturnValue({
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://api.example.com/v1',
      AI_MODEL: 'test-model',
    } as any)
    global.fetch = vi.fn(() => Promise.reject(new Error('network down'))) as any

    const result = await aiProvider.answerFromKnowledge({
      question: 'Any villas?',
      knowledge: [],
      locale: 'en',
    })
    expect(result.shouldEscalate).toBe(true)
  })
})
