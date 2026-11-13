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
    select: { name: true, timezone: true, defaultLocale: true, chatBot: true },
  })
  if (!d) throw new HttpError(404, 'UNKNOWN_KEY')
  const b = d.chatBot
  return NextResponse.json(
    {
      ok: true,
      config: {
        domainName: d.name,
        timezone: d.timezone,
        defaultLocale: d.defaultLocale,
        brand: {
          botName: b?.botName ?? null,
          welcomeMessage: b?.welcomeMessage ?? null,
          avatarUrl: b?.avatarUrl ?? null,
          primaryColor: b?.primaryColor ?? null,
          textColor: b?.textColor ?? null,
          position: b?.position ?? 'BOTTOM_RIGHT',
          launcherLabel: b?.launcherLabel ?? null,
          fontFamily: b?.fontFamily ?? null,
          borderRadius: b?.borderRadius ?? 'MD',
          privacyPolicyUrl: b?.privacyPolicyUrl ?? null,
          consentText: b?.consentText ?? null,
          offlineMessage: b?.offlineMessage ?? null,
          showPoweredBy: b?.showPoweredBy ?? true,
        },
        features: { booking: b?.bookingEnabled ?? true, handoff: b?.handoffEnabled ?? true },
      },
    },
    { headers: { 'Cache-Control': 'public, max-age=30' } }
  )
})
