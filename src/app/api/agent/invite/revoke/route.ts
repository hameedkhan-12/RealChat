import { NextResponse } from 'next/server'
import { handle, readJson, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireUser, requireDomainAccess } from '@/lib/auth'
import { client } from '@/lib/prisma'
import { z } from 'zod'

const RevokeInviteBody = z.object({
  inviteId: z.string().trim().min(1).max(64),
})

export const POST = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`invite:revoke:${ip}`, 20, 60, true)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { user } = await requireUser()

  const input = await readJson(req, RevokeInviteBody, 4096)

  const invite = await client.domainInvite.findUnique({
    where: { id: input.inviteId },
    select: { id: true, domainId: true, acceptedAt: true },
  })
  if (!invite) throw new HttpError(403, 'FORBIDDEN')

  // Verify the user is an OWNER of the domain
  const access = await requireDomainAccess(invite.domainId, 'OWNER')

  // Only pending invitations can be revoked
  if (invite.acceptedAt !== null) throw new HttpError(409, 'ALREADY_ACCEPTED')

  await client.domainInvite.delete({ where: { id: input.inviteId } })

  return NextResponse.json({ ok: true, data: { message: 'Invitation revoked' } })
})
