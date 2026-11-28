import React from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatBot } from '@/hooks/chatbot/use-chatbot'

const { pusherInstances } = vi.hoisted(() => ({ pusherInstances: [] as any[] }))

vi.mock('pusher-js', () => ({
  default: class MockPusher {
    options: any
    connection = { bind: vi.fn() }
    constructor(_key: string, options: any) {
      this.options = options
      pusherInstances.push(this)
    }
    subscribe() {
      return { bind: vi.fn(), unbind: vi.fn() }
    }
    disconnect = vi.fn()
  },
}))

const PUBLIC_KEY = 'abcdef1234567890abcdef1234567890abcdef12'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function baseConfig(overrides: Record<string, any> = {}) {
  return {
    ok: true,
    domain: { publicKey: PUBLIC_KEY, name: 'Acme', timezone: 'UTC', defaultLocale: 'en' },
    brand: {
      name: 'Acme',
      logoUrl: null,
      primaryColor: null,
      textColor: null,
      avatarUrl: null,
      position: 'BOTTOM_RIGHT',
      welcomeMessage: null,
      consentText: null,
      privacyPolicyUrl: null,
      offlineMessage: null,
      showPoweredBy: true,
      launcherLabel: null,
    },
    features: { questionnaire: true, handoff: true, booking: true },
    turnstile: { enabled: false, siteKey: null },
    flow: { version: 1, steps: [] },
    ...overrides,
  }
}

const restoredPayload = {
  ok: true,
  chatRoomId: 'room-restored',
  consentGiven: true,
  status: 'BOT',
  currentStepKey: 'name',
  messages: [],
}

const createdPayload = { ok: true, sessionToken: 'new-token', chatRoomId: 'room-new' }

function installFetch(handlers: {
  config?: () => Response
  messages?: () => Response
  session?: () => Response
  message?: () => Response
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/widget/config')) {
      return handlers.config ? handlers.config() : jsonResponse(baseConfig())
    }
    if (url.includes('/api/widget/messages')) {
      return handlers.messages ? handlers.messages() : jsonResponse(restoredPayload)
    }
    if (url.includes('/api/widget/session')) {
      return handlers.session ? handlers.session() : jsonResponse(createdPayload)
    }
    if (url.includes('/api/widget/message')) {
      return handlers.message ? handlers.message() : jsonResponse({ ok: true, messages: [] })
    }
    return jsonResponse({ ok: false }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sessionCalls(fetchMock: ReturnType<typeof installFetch>): any[] {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/widget/session'))
}

function renderChat(options: Record<string, any> = {}, strict = false) {
  const wrapper = strict
    ? ({ children }: { children: React.ReactNode }) => (
        <React.StrictMode>{children}</React.StrictMode>
      )
    : undefined
  return renderHook(() => useChatBot({ publicKey: PUBLIC_KEY, ...options }), { wrapper })
}

describe('useChatBot session orchestrator', () => {
  beforeEach(() => {
    window.localStorage.clear()
    pusherInstances.length = 0
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('restores a valid session before creating a new one', async () => {
    window.localStorage.setItem(`realchat:${PUBLIC_KEY}:session_token`, 'stored-token')
    const fetchMock = installFetch({ messages: () => jsonResponse(restoredPayload) })

    const { result } = renderChat()

    await waitFor(() => expect(result.current.sessionToken).toBe('stored-token'))
    expect(result.current.chatRoomId).toBe('room-restored')
    expect(result.current.consentGiven).toBe(true)
    expect(sessionCalls(fetchMock)).toHaveLength(0)
    // Restore is read-only: no session POST and no attribution overwrite.
    expect((fetchMock.mock.calls as any[]).every(([, init]) => !init || init.method !== 'POST')).toBe(true)
  })

  it('creates exactly one session even when effects run twice', async () => {
    const fetchMock = installFetch({ messages: () => jsonResponse(restoredPayload) })

    const { result, rerender } = renderChat({}, true)
    rerender()

    await waitFor(() => expect(result.current.sessionToken).toBe('new-token'))
    expect(sessionCalls(fetchMock)).toHaveLength(1)
  })

  it('never creates a session before a Turnstile token is available', async () => {
    const fetchMock = installFetch({
      config: () => jsonResponse(baseConfig({ turnstile: { enabled: true, siteKey: 'site-key' } })),
      messages: () => jsonResponse(restoredPayload),
    })

    const { result } = renderChat()

    await waitFor(() => expect(result.current.config).toBeDefined())
    expect(sessionCalls(fetchMock)).toHaveLength(0)
    expect(result.current.sessionToken).toBeUndefined()

    act(() => result.current.onTurnstileToken('turnstile-token'))

    await waitFor(() => expect(result.current.sessionToken).toBe('new-token'))
    expect(sessionCalls(fetchMock)).toHaveLength(1)
    const body = JSON.parse((sessionCalls(fetchMock)[0] as any)[1].body)
    expect(body.turnstileToken).toBe('turnstile-token')
  })

  it('passes page URL, UTM params and locale into session creation', async () => {
    const fetchMock = installFetch({ messages: () => jsonResponse(restoredPayload) })

    const { result } = renderChat({
      pageUrl: 'https://example.com/pricing',
      utm: { utm_source: 'google', utm_campaign: 'spring' },
      locale: 'ar',
    })

    await waitFor(() => expect(result.current.sessionToken).toBe('new-token'))
    const body = JSON.parse((sessionCalls(fetchMock)[0] as any)[1].body)
    expect(body).toMatchObject({
      key: PUBLIC_KEY,
      pageUrl: 'https://example.com/pricing',
      utm: { utm_source: 'google', utm_campaign: 'spring' },
      locale: 'ar',
    })
    expect(body).not.toHaveProperty('domainId')
    expect(body).not.toHaveProperty('customerId')
  })

  it('only records consent after the server confirms it', async () => {
    let consentResponse = () => jsonResponse({ ok: false }, 500)
    const fetchMock = installFetch({
      messages: () => jsonResponse(restoredPayload),
      message: () => consentResponse(),
    })

    const { result } = renderChat()
    await waitFor(() => expect(result.current.sessionToken).toBe('new-token'))

    await act(async () => {
      await result.current.acceptConsent()
    })
    expect(result.current.consentGiven).toBe(false)
    expect(result.current.errors).toBeTruthy()

    consentResponse = () =>
      jsonResponse({ ok: true, messages: [{ id: 'm1', content: 'Next question' }] })

    await act(async () => {
      await result.current.acceptConsent()
    })
    await waitFor(() => expect(result.current.consentGiven).toBe(true))
    expect(result.current.onChats[0]?.content).toBe('Next question')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/widget/message'))).toBe(true)
  })

  it('stores the session token under the public-key-scoped key only', async () => {
    installFetch({ messages: () => jsonResponse(restoredPayload) })

    const { result } = renderChat()
    await waitFor(() => expect(result.current.sessionToken).toBe('new-token'))

    expect(window.localStorage.getItem(`realchat:${PUBLIC_KEY}:session_token`)).toBe('new-token')
    expect(window.localStorage.getItem(`realchat:${PUBLIC_KEY}:chat_room_id`)).toBe('room-new')
    expect(window.localStorage.getItem('realchat_session_token')).toBeNull()
  })

  it('sends the visitor bearer token to Pusher auth', async () => {
    vi.stubEnv('NEXT_PUBLIC_PUSHER_KEY', 'pusher-key')
    vi.stubEnv('NEXT_PUBLIC_PUSHER_CLUSTER', 'eu')
    installFetch({ messages: () => jsonResponse(restoredPayload) })

    const { result } = renderChat()
    await waitFor(() => expect(result.current.sessionToken).toBe('new-token'))
    await waitFor(() => expect(pusherInstances).toHaveLength(1))

    expect(pusherInstances[0].options.auth.headers).toEqual({
      Authorization: 'Bearer new-token',
    })
  })

  it('retries safely after a failed session creation', async () => {
    let attempt = 0
    const fetchMock = installFetch({
      messages: () => jsonResponse(restoredPayload),
      session: () => {
        attempt += 1
        return attempt === 1 ? jsonResponse({ ok: false }, 500) : jsonResponse(createdPayload)
      },
    })

    const { result } = renderChat()
    await waitFor(() => expect(result.current.errors).toBeTruthy())
    expect(sessionCalls(fetchMock)).toHaveLength(1)

    act(() => result.current.retrySession())
    await waitFor(() => expect(result.current.sessionToken).toBe('new-token'))
    expect(sessionCalls(fetchMock)).toHaveLength(2)
  })

  it('discards an invalid restored session and creates a new one', async () => {
    window.localStorage.setItem(`realchat:${PUBLIC_KEY}:session_token`, 'stale-token')
    const fetchMock = installFetch({
      messages: () => jsonResponse({ ok: false, error: 'INVALID_SESSION' }, 401),
    })

    const { result } = renderChat()
    await waitFor(() => expect(result.current.sessionToken).toBe('new-token'))

    expect(sessionCalls(fetchMock)).toHaveLength(1)
    expect(window.localStorage.getItem(`realchat:${PUBLIC_KEY}:session_token`)).toBe('new-token')
  })
})
