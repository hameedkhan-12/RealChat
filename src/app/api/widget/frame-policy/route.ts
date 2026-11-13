import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { PublicKeySchema } from '@/lib/validation'

export const GET = handle(async (req: Request) => {
  const rl = await rateLimit(`frame:${getClientIp(req)}`, 300, 60)
  if (!rl.success) return NextResponse.json({ ancestors: [] }, { status: 429 })
  const key = new URL(req.url).searchParams.get('key') ?? ''
  if (!PublicKeySchema.safeParse(key).success) return NextResponse.json({ ancestors: [] })
  const d = await client.domain.findUnique({ where: { publicKey: key }, select: { allowedOrigins: true } })
  return NextResponse.json({ ancestors: d?.allowedOrigins ?? [] })
})
