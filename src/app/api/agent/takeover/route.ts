import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireDomainAccess } from '@/lib/auth'
import { getPusherServer, roomChannel } from '@/lib/pusher-server'

export const POST = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`takeover:${ip}`, 10, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const body = await req.json()
  const { domainId, chatRoomId } = body as { domainId?: string; chatRoomId?: string }
  if (!domainId || !chatRoomId) throw new HttpError(400, 'MISSING_PARAMS')

  const { user } = await requireDomainAccess(domainId, 'AGENT')

  // Atomic claim: only update if room is WAITING_AGENT and unassigned
  // Prisma updateMany generates a single SQL UPDATE with WHERE clause - atomic at DB level
  const updated = await client.chatRoom.updateMany({
    where: {
      id: chatRoomId,
      domainId,
      status: 'WAITING_AGENT',
      assignedToUserId: null,
    },
    data: {
      status: 'LIVE',
      assignedToUserId: user.id,
      lastActivityAt: new Date(),
    },
  })

  if (updated.count === 0) {
    // Room not found, not WAITING_AGENT, or already assigned
    throw new HttpError(409, 'ROOM_NOT_CLAIMABLE')
  }

  const room = await client.chatRoom.findUnique({
    where: { id: chatRoomId },
    select: { id: true, status: true, assignedToUserId: true },
  })

  // Publish realtime event after successful DB commit
  const pusher = getPusherServer()
  if (pusher) {
    try {
      await pusher.trigger(roomChannel(chatRoomId), 'room.updated', {
        roomId: chatRoomId,
        status: 'LIVE',
        assignedToUserId: user.id,
      })
    } catch {
      // Pusher failure is non-fatal - DB is source of truth
    }
  }

  return NextResponse.json({ ok: true, chatRoom: room })
})
