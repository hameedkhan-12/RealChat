import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getEnv } from '@/env'

vi.mock('@/env', () => ({
  getEnv: vi.fn(),
}))

import { aiProvider } from '@/server/ai'

const originalFetch = global.fetch
const originalLog = console.log
const originalError = console.error
const logCalls: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  logCalls.length = 0
  console.log = (...args: unknown[]) => logCalls.push(args.join(' '))
  console.error = (...args: unknown[]) => logCalls.push(args.join(' '))
})

afterEach(() => {
  global.fetch = originalFetch
  console.log = originalLog
  console.error = originalError
})

describe('aiProvider', () => {
  it('returns fallback when provider not configured - no PII in logs', async () => {
    vi.mocked(getEnv).mockReturnValue({} as any)
    const result = await aiProvider.answerFromKnowledge({
      question: 'sensitive visitor question with PII john@example.com',
      knowledge: [],
      locale: 'en',
    })
    expect(result.shouldEscalate).toBe(true)
    expect(result.answer).toContain('team member')
    const logText = logCalls.join(' ')
    expect(logText).not.toContain('john@example.com')
    expect(logText).not.toContain('sensitive visitor question')
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
  })

  it('returns fallback when provider returns invalid JSON', async () => {
    vi.mocked(getEnv).mockReturnValue({
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://api.example.com/v1',
      AI_MODEL: 'test-model',
    } as any)
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: 'not json' } }] }),
      }) as any
    )

    const result = await aiProvider.answerFromKnowledge({
      question: 'Any villas?',
      knowledge: [{ title: 'Villas', content: 'We have villas available.' }],
      locale: 'en',
    })
    expect(result.shouldEscalate).toBe(true)
  })

  it('returns fallback on provider network error', async () => {
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

  it('passes AbortController signal to fetch', async () => {
    vi.mocked(getEnv).mockReturnValue({
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://api.example.com/v1',
      AI_MODEL: 'test-model',
    } as any)
    let capturedSignal: AbortSignal | undefined
    global.fetch = vi.fn((url, opts) => {
      capturedSignal = (opts as any)?.signal
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: JSON.stringify({ answer: 'answer', shouldEscalate: false }) } }],
          }),
      }) as any
    })

    await aiProvider.answerFromKnowledge({
      question: 'Any villas?',
      knowledge: [{ title: 'Villas', content: 'We have villas available.' }],
      locale: 'en',
    })
    expect(capturedSignal).toBeDefined()
    expect(typeof capturedSignal?.aborted).toBe('boolean')
  })
})
