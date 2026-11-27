import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { PublicKeySchema, WidgetConfigSchema } from '@/lib/validation'

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
    options: Array.isArray(s.options)
      ? (s.options as { label: string; value: string }[]).map((o) => o.value)
      : null,
  }))

  const config = WidgetConfigSchema.parse({
    ok: true,
    domain: {
      publicKey: key,
      name: d.name,
      timezone: d.timezone,
      defaultLocale: d.defaultLocale,
    },
    brand: {
      name: b?.botName ?? d.name,
      logoUrl: b?.avatarUrl ?? null,
      primaryColor: b?.primaryColor ?? null,
      welcomeMessage: b?.welcomeMessage ?? null,
    },
    features: {
      questionnaire: true,
      handoff: b?.handoffEnabled ?? true,
      booking: b?.bookingEnabled ?? true,
    },
    turnstile: {
      enabled: Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
      siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null,
    },
    flow: { version: 1, steps },
  })

  return NextResponse.json(config, { headers: { 'Cache-Control': 'public, max-age=30' } })
})
