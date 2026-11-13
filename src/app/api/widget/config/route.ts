import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { PublicKeySchema } from '@/lib/validation'

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

  const flow = await client.flowStep.findMany({
    where: { domainId: d.id, isActive: true },
    orderBy: { position: 'asc' },
    select: { key: true, type: true, prompt: true, options: true, required: true },
  })

  return NextResponse.json(
    {
      ok: true,
      bot: {
        name: b?.botName ?? d.name,
        welcomeMessage: b?.welcomeMessage ?? null,
        primaryColor: b?.primaryColor ?? null,
        position: b?.position ?? 'BOTTOM_RIGHT',
        consentText: b?.consentText ?? null,
        privacyPolicyUrl: b?.privacyPolicyUrl ?? null,
        handoffEnabled: b?.handoffEnabled ?? true,
      },
      locale: d.defaultLocale,
      flow: flow.map((s) => ({
        key: s.key,
        type: s.type,
        prompt: s.prompt,
        options: Array.isArray(s.options) ? (s.options as { label: string; value: string }[]).map((o) => o.value) : null,
        required: s.required,
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=30' } }
  )
})
