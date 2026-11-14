import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireWidgetSession } from '@/lib/widget-auth'
import { sendMail } from '@/lib/mail'
import { getPusherServer, roomChannel } from '@/lib/pusher-server'

export const POST = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`handoff:${ip}`, 10, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { room } = await requireWidgetSession(req)

  // Handoff only allowed from BOT or LIVE state
  if (room.status === 'CLOSED' || room.status === 'WAITING_AGENT') {
    throw new HttpError(409, 'ROOM_NOT_CLAIMABLE')
  }

  await client.chatRoom.update({
    where: { id: room.id },
    data: { status: 'WAITING_AGENT', lastActivityAt: new Date() },
  })

  // Notify tenant via email (notificationEmails)
  const emails = room.domain.notificationEmails ?? []
  if (emails.length && room.customer) {
    try {
      await sendMail({
        to: emails,
        subject: 'New chat handoff request',
        text: `A visitor requested to talk to a person. Customer: ${room.customer.email ?? room.customer.name ?? 'unknown'}. Chat room: ${room.id}`,
      })
    } catch {
      // email failure should not break the flow
    }
  }

  // Publish realtime event for agents
  const pusher = getPusherServer()
  if (pusher) {
    try {
      await pusher.trigger(roomChannel(room.id), 'handoff.requested', {
        roomId: room.id,
        status: 'WAITING_AGENT',
      })
    } catch {
      // Pusher failure is non-fatal
    }
  }

  return NextResponse.json({ ok: true, chatRoomId: room.id, status: 'WAITING_AGENT' })
})
