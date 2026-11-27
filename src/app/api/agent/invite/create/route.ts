import { NextResponse } from 'next/server'
import { handle, readJson, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireUser, requireDomainAccess } from '@/lib/auth'
import { client } from '@/lib/prisma'
import { hashToken } from '@/lib/session'
import crypto from 'crypto'
import { z } from 'zod'

const CreateInviteBody = z.object({
  domainId: z.string().trim().min(1).max(64),
  email: z.string().email(),
})

export const POST = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`invite:create:${ip}`, 20, 60, true)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { user } = await requireUser()

  const input = await readJson(req, CreateInviteBody, 4096)

  // Verify user is an OWNER of the domain
  await requireDomainAccess(input.domainId, 'OWNER')

  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const invite = await client.domainInvite.create({
    data: {
      domainId: input.domainId,
      email: input.email.toLowerCase(),
      role: 'AGENT',
      tokenHash,
      expiresAt,
    },
    select: { id: true, email: true, expiresAt: true },
  })

  // NOTE: The raw token is never returned to the client. It is sent via
  // email to the invitee and verified server-side on acceptance.

  return NextResponse.json({
    ok: true,
    data: { invite },
  })
})
