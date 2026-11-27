import { NextResponse } from 'next/server'
import { handle, readJson, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireUser } from '@/lib/auth'
import { client } from '@/lib/prisma'
import { hashToken } from '@/lib/session'
import { z } from 'zod'

const AcceptInviteBody = z.object({
  token: z.string().trim().min(1).max(128),
})

export const POST = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`invite:accept:${ip}`, 20, 60, true)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { user, clerk } = await requireUser()

  const input = await readJson(req, AcceptInviteBody, 4096)

  const tokenHash = hashToken(input.token)

  const invite = await client.domainInvite.findUnique({
    where: { tokenHash },
  })

  if (!invite) throw new HttpError(403, 'INVALID_TOKEN')
  if (invite.acceptedAt !== null) throw new HttpError(403, 'TOKEN_ALREADY_USED')
  if (invite.expiresAt < new Date()) throw new HttpError(403, 'TOKEN_EXPIRED')
  if (invite.email.toLowerCase() !== (clerk.primaryEmailAddress?.emailAddress ?? '').toLowerCase()) {
    throw new HttpError(403, 'WRONG_EMAIL')
  }

  // Atomic: create membership and mark invitation accepted in one transaction
  const result = await client.$transaction(async (tx) => {
    const membership = await tx.domainMember.create({
      data: { domainId: invite.domainId, userId: user.id, role: invite.role },
    })
    const updated = await tx.domainInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    })
    return { membership, updatedInvite: updated }
  })

  return NextResponse.json({
    ok: true,
    data: {
      domainId: result.membership.domainId,
      role: result.membership.role,
      userId: result.membership.userId,
    },
  })
})
