import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, readJson, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireDomainAccess } from '@/lib/auth'
import { z } from 'zod'
import { getPusherServer, roomChannel } from '@/lib/pusher-server'

const AgentMessageBody = z.object({
  domainId: z.string().uuid(),
  chatRoomId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
})

export const POST = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`agent:msg:${ip}`, 30, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  // Parse body once — req.body stream can only be consumed once
  const input = await readJson(req, AgentMessageBody, 16_384)

  const { user } = await requireDomainAccess(input.domainId, 'AGENT')

  // Verify the room belongs to this domain
  const room = await client.chatRoom.findUnique({
    where: { id: input.chatRoomId },
    select: { id: true, domainId: true, status: true, assignedToUserId: true },
  })
  if (!room || room.domainId !== input.domainId) {
    throw new HttpError(403, 'FORBIDDEN') // do not leak which rooms exist
  }

  // Agent can only message rooms assigned to them (or rooms that are LIVE/WARNING_AGENT)
  if (room.status !== 'LIVE' && room.status !== 'WAITING_AGENT') {
    throw new HttpError(409, 'ROOM_NOT_ACTIVE')
  }
  if (room.assignedToUserId && room.assignedToUserId !== user.id) {
    throw new HttpError(403, 'FORBIDDEN') // not assigned to this agent
  }

  // Sender type is ALWAYS AGENT — never trust client-supplied role
  const message = await client.chatMessage.create({
    data: {
      chatRoomId: input.chatRoomId,
      message: input.content,
      senderType: 'AGENT',
      senderUserId: user.id,
    },
    select: { id: true, message: true, senderType: true, createdAt: true },
  })

  await client.chatRoom.update({
    where: { id: input.chatRoomId },
    data: { lastActivityAt: new Date() },
  })

  // Publish realtime event
  const pusher = getPusherServer()
  if (pusher) {
    try {
      await pusher.trigger(roomChannel(input.chatRoomId), 'message.created', {
        roomId: input.chatRoomId,
        messageId: message.id,
      })
    } catch {
      // non-fatal
    }
  }

  return NextResponse.json({ ok: true, message })
})
