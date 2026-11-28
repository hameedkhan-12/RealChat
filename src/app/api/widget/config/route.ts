import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { IanaTimezoneSchema, LocaleSchema, PublicKeySchema, WidgetConfigSchema } from '@/lib/validation'

/** Flow options are stored as `{ label, value }` objects, but older rows may be plain strings. */
function optionValues(options: unknown): string[] {
  if (!Array.isArray(options)) return []
  const values: string[] = []
  for (const option of options) {
    if (typeof option === 'string') {
      values.push(option)
    } else if (option && typeof option === 'object' && 'value' in option) {
      const value = (option as { value?: unknown }).value
      if (typeof value === 'string') values.push(value)
    }
  }
  return values
}

export const GET = handle(async (req: Request) => {
  const rl = await rateLimit(`cfg:${getClientIp(req)}`, 120, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')
  const key = new URL(req.url).searchParams.get('key') ?? ''
  if (!PublicKeySchema.safeParse(key).success) throw new HttpError(400, 'BAD_KEY')

  const d = await client.domain.findUnique({
    where: { publicKey: key },
    select: { id: true, name: true, timezone: true, defaultLocale: true, chatBot: true },
  })
  if (!d) throw new HttpError(404, 'UNKNOWN_KEY')
  const b = d.chatBot

  const flowSteps = await client.flowStep.findMany({
    where: { domainId: d.id, isActive: true },
    orderBy: { position: 'asc' },
    select: { key: true, prompt: true, type: true, options: true, required: true },
  })

  const steps = flowSteps.map((s) => ({
    key: s.key,
    question: s.prompt,
    type: s.type,
    required: s.required,
    options: optionValues(s.options),
  }))

  // Normalise tenant-controlled values so the shared client schema can never
  // fail on a legacy row. Never expose internal identifiers or secrets here.
  const defaultLocale = LocaleSchema.safeParse(d.defaultLocale).success
    ? (d.defaultLocale as 'en' | 'ar')
    : 'en'
  const timezone = IanaTimezoneSchema.safeParse(d.timezone).success ? d.timezone : 'UTC'
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || undefined
  const turnstileEnabled = Boolean(turnstileSecret && siteKey)

  const config = WidgetConfigSchema.parse({
    ok: true,
    domain: {
      publicKey: key,
      name: d.name,
      timezone,
      defaultLocale,
    },
    brand: {
      name: b?.botName?.trim() || d.name,
      logoUrl: b?.avatarUrl ?? null,
      primaryColor: b?.primaryColor ?? null,
      textColor: b?.textColor ?? null,
      avatarUrl: b?.avatarUrl ?? null,
      position: b?.position ?? 'BOTTOM_RIGHT',
      welcomeMessage: b?.welcomeMessage ?? null,
      consentText: b?.consentText ?? null,
      privacyPolicyUrl: b?.privacyPolicyUrl ?? null,
      offlineMessage: b?.offlineMessage ?? null,
      showPoweredBy: b?.showPoweredBy ?? true,
      launcherLabel: b?.launcherLabel ?? null,
    },
    features: {
      questionnaire: true,
      handoff: b?.handoffEnabled ?? true,
      booking: b?.bookingEnabled ?? true,
    },
    turnstile: {
      enabled: turnstileEnabled,
      siteKey,
    },
    flow: { version: 1, steps },
  })

  return NextResponse.json(config, { headers: { 'Cache-Control': 'public, max-age=30' } })
})
