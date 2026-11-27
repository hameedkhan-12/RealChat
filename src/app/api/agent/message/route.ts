import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, readJson, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireDomainAccess } from '@/lib/auth'
import { z } from 'zod'
import { createAgentMessage } from '@/server/conversation-ownership'

const AgentMessageBody = z.object({
  domainId: z.string().uuid(),
  chatRoomId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
})

export const POST = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`agent:msg:${ip}`, 30, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const input = await readJson(req, AgentMessageBody, 16_384)

  const { user } = await requireDomainAccess(input.domainId, 'AGENT')

  // Atomic: ownership check + message insert + lastActivityAt update all in one
  // transaction. Ownership cannot change between check and insert.
  const message = await client.$transaction(async (tx) => {
    return createAgentMessage(tx, input.chatRoomId, user.id, input.content)
  })

  return NextResponse.json({ ok: true, message })
})
