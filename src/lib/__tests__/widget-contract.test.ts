import { describe, it, expect } from 'vitest'
import { SessionBody, WidgetConfigSchema } from '@/lib/validation'

const PUBLIC_KEY = 'abcdef1234567890abcdef1234567890abcdef12'

function validConfig() {
  return {
    ok: true,
    domain: {
      publicKey: PUBLIC_KEY,
      name: 'Acme',
      timezone: 'Europe/London',
      defaultLocale: 'ar',
    },
    brand: {
      name: 'Acme Bot',
      logoUrl: null,
      primaryColor: '#111111',
      textColor: '#ffffff',
      avatarUrl: null,
      position: 'BOTTOM_LEFT',
      welcomeMessage: 'Hi',
      consentText: 'Terms',
      privacyPolicyUrl: null,
      offlineMessage: null,
      showPoweredBy: false,
      launcherLabel: 'Chat',
    },
    features: { questionnaire: true, handoff: false, booking: false },
    turnstile: { enabled: true, siteKey: 'site-key' },
    flow: {
      version: 1,
      steps: [
        { key: 'name', question: 'Your name?', type: 'TEXT', required: true, options: [] },
      ],
    },
  }
}

describe('WidgetConfigSchema', () => {
  it('accepts the complete config contract returned by the API', () => {
    const parsed = WidgetConfigSchema.parse(validConfig())
    expect(parsed.domain.publicKey).toBe(PUBLIC_KEY)
    expect(parsed.brand.position).toBe('BOTTOM_LEFT')
    expect(parsed.flow.steps[0].options).toEqual([])
  })

  it('defaults missing step options to an empty array instead of null', () => {
    const config = validConfig()
    delete (config.flow.steps[0] as { options?: string[] }).options
    const parsed = WidgetConfigSchema.parse(config)
    expect(parsed.flow.steps[0].options).toEqual([])
  })

  it('rejects a config that omits client-required brand fields', () => {
    const config = validConfig() as any
    delete config.brand.textColor
    const result = WidgetConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects an invalid locale or timezone', () => {
    const badLocale = validConfig()
    badLocale.domain.defaultLocale = 'fr'
    expect(WidgetConfigSchema.safeParse(badLocale).success).toBe(false)

    const badTimezone = validConfig()
    badTimezone.domain.timezone = 'Mars/Olympus'
    expect(WidgetConfigSchema.safeParse(badTimezone).success).toBe(false)
  })
})

describe('SessionBody', () => {
  it('accepts page URL, UTM params and locale', () => {
    const parsed = SessionBody.parse({
      key: PUBLIC_KEY,
      pageUrl: 'https://example.com/pricing?x=1',
      utm: { utm_source: 'google', utm_campaign: 'spring' },
      locale: 'ar',
    })
    expect(parsed.pageUrl).toBe('https://example.com/pricing?x=1')
    expect(parsed.utm).toEqual({ utm_source: 'google', utm_campaign: 'spring' })
    expect(parsed.locale).toBe('ar')
  })

  it('strips client-supplied tenant identifiers', () => {
    const parsed = SessionBody.parse({
      key: PUBLIC_KEY,
      domainId: 'attacker-domain',
      customerId: 'attacker-customer',
      tenantId: 'attacker-tenant',
    }) as Record<string, unknown>
    expect(parsed).not.toHaveProperty('domainId')
    expect(parsed).not.toHaveProperty('customerId')
    expect(parsed).not.toHaveProperty('tenantId')
  })

  it('rejects non-http page URLs', () => {
    expect(SessionBody.safeParse({ key: PUBLIC_KEY, pageUrl: 'javascript:alert(1)' }).success).toBe(false)
    expect(SessionBody.safeParse({ key: PUBLIC_KEY, pageUrl: 'not-a-url' }).success).toBe(false)
  })

  it('rejects non-UTM keys and too many UTM params', () => {
    expect(SessionBody.safeParse({ key: PUBLIC_KEY, utm: { source: 'google' } }).success).toBe(false)

    const tooMany: Record<string, string> = {}
    for (let i = 0; i < 11; i += 1) tooMany[`utm_${i}`] = 'x'
    expect(SessionBody.safeParse({ key: PUBLIC_KEY, utm: tooMany }).success).toBe(false)
  })

  it('rejects an unsupported locale', () => {
    expect(SessionBody.safeParse({ key: PUBLIC_KEY, locale: 'fr' }).success).toBe(false)
  })
})
