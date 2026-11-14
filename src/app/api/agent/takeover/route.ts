import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireDomainAccess } from '@/lib/auth'

export const POST = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`takeover:${ip}`, 10, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { domainId, chatRoomId } = await req.json()
  if (!domainId || !chatRoomId) throw new HttpError(400, 'MISSING_PARAMS')

  const { user } = await requireDomainAccess(domainId, 'AGENT')

  // Atomic claim: only update if room is BOT or WAITING_AGENT and unassigned
  const updated = await client.chatRoom.updateMany({
    where: {
      id: chatRoomId,
      domainId,
      status: { in: ['BOT', 'WAITING_AGENT'] },
      assignedToUserId: null,
    },
    data: {
      status: 'LIVE',
      assignedToUserId: user.id,
      lastActivityAt: new Date(),
    },
  })

  if (updated.count === 0) {
    // Room not found, not in claimable state, or already assigned
    throw new HttpError(409, 'ROOM_NOT_CLAIMABLE')
  }

  const room = await client.chatRoom.findUnique({
    where: { id: chatRoomId },
    select: { id: true, status: true, assignedToUserId: true },
  })

  return NextResponse.json({ ok: true, chatRoom: room })
})
