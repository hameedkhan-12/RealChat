import { NextResponse } from 'next/server'
import { handle, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireUser, requireDomainAccess } from '@/lib/auth'
import { client } from '@/lib/prisma'

export const GET = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`invite:list:${ip}`, 30, 60, true)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { user } = await requireUser()

  const { searchParams } = new URL(req.url)
  const domainId = searchParams.get('domainId')

  if (!domainId) throw new HttpError(400, 'MISSING_DOMAIN_ID')

  // Verify user is an owner of the domain
  await requireDomainAccess(domainId, 'OWNER')

  const invites = await client.domainInvite.findMany({
    where: { domainId, acceptedAt: null },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    ok: true,
    data: { invites },
  })
})
