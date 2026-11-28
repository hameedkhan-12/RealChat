import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { client } from '@/lib/prisma'

const PUBLIC_KEY = 'abcdef1234567890abcdef1234567890abcdef12'

function request(key = PUBLIC_KEY): Request {
  return new Request(`http://localhost/api/widget/config?key=${key}`)
}

describe('GET /api/widget/config', () => {
  beforeEach(() => {
    vi.mocked(client.domain.findUnique).mockReset()
    vi.mocked(client.flowStep.findMany).mockReset()
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns every client-required field from DB values and defaults', async () => {
    vi.mocked(client.domain.findUnique).mockResolvedValue({
      id: 'internal-domain-id',
      name: 'Acme',
      timezone: 'Europe/London',
      defaultLocale: 'ar',
      chatBot: {
        botName: 'Acme Bot',
        avatarUrl: 'https://cdn.example.com/avatar.png',
        primaryColor: '#112233',
        textColor: '#ffffff',
        position: 'BOTTOM_LEFT',
        welcomeMessage: 'Welcome!',
        consentText: 'We use cookies.',
        privacyPolicyUrl: 'https://example.com/privacy',
        offlineMessage: 'Back soon',
        showPoweredBy: false,
        launcherLabel: 'Chat with us',
        bookingEnabled: false,
        handoffEnabled: false,
      },
    } as any)
    vi.mocked(client.flowStep.findMany).mockResolvedValue([
      { key: 'name', prompt: 'Your name?', type: 'TEXT', options: null, required: true },
      {
        key: 'topic',
        prompt: 'What is it about?',
        type: 'CHOICE',
        options: [
          { label: 'Sales', value: 'sales' },
          { label: 'Support', value: 'support' },
        ],
        required: false,
      },
    ] as any)

    const res = await GET(request())
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.domain).toEqual({
      publicKey: PUBLIC_KEY,
      name: 'Acme',
      timezone: 'Europe/London',
      defaultLocale: 'ar',
    })
    expect(json.brand).toMatchObject({
      name: 'Acme Bot',
      textColor: '#ffffff',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      position: 'BOTTOM_LEFT',
      welcomeMessage: 'Welcome!',
      consentText: 'We use cookies.',
      privacyPolicyUrl: 'https://example.com/privacy',
      offlineMessage: 'Back soon',
      showPoweredBy: false,
      launcherLabel: 'Chat with us',
    })
    expect(json.features).toEqual({ questionnaire: true, handoff: false, booking: false })
    expect(json.turnstile).toEqual({ enabled: false, siteKey: null })
    expect(json.flow.steps[0].options).toEqual([])
    expect(json.flow.steps[1].options).toEqual(['sales', 'support'])

    // Never leak internal identifiers.
    expect(json.domain).not.toHaveProperty('id')
    expect(JSON.stringify(json)).not.toContain('internal-domain-id')
  })

  it('normalises legacy locale/timezone values and applies brand defaults', async () => {
    vi.mocked(client.domain.findUnique).mockResolvedValue({
      id: 'domain-1',
      name: 'Legacy Co',
      timezone: 'Not/AZone',
      defaultLocale: 'fr',
      chatBot: null,
    } as any)
    vi.mocked(client.flowStep.findMany).mockResolvedValue([])

    const res = await GET(request())
    const json = await res.json()

    expect(json.domain.timezone).toBe('UTC')
    expect(json.domain.defaultLocale).toBe('en')
    expect(json.brand).toMatchObject({
      name: 'Legacy Co',
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
    })
    expect(json.flow.steps).toEqual([])
  })

  it('exposes the Turnstile site key but never the secret', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'super-secret-value')
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key-public')
    vi.mocked(client.domain.findUnique).mockResolvedValue({
      id: 'domain-1',
      name: 'Acme',
      timezone: 'UTC',
      defaultLocale: 'en',
      chatBot: null,
    } as any)
    vi.mocked(client.flowStep.findMany).mockResolvedValue([])

    const res = await GET(request())
    const json = await res.json()

    expect(json.turnstile).toEqual({ enabled: true, siteKey: 'site-key-public' })
    expect(JSON.stringify(json)).not.toContain('super-secret-value')
  })

  it('rejects malformed and unknown public keys', async () => {
    const bad = await GET(request('not-a-key'))
    expect(bad.status).toBe(400)

    vi.mocked(client.domain.findUnique).mockResolvedValue(null)
    const unknown = await GET(request())
    expect(unknown.status).toBe(404)
  })
})
