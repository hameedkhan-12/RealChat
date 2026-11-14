import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireWidgetSession } from '@/lib/widget-auth'

export const GET = handle(async (req: Request) => {
  const { room } = await requireWidgetSession(req)
  const rl = await rateLimit(`msgs:room:${room.id}`, 60, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  // Closed conversations cannot receive new messages or be fetched
  if (room.status === 'CLOSED') throw new HttpError(409, 'ROOM_CLOSED')

  const messages = await client.chatMessage.findMany({
    where: { chatRoomId: room.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { id: true, senderType: true, message: true, createdAt: true },
  })

  return NextResponse.json(
    {
      ok: true,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.senderType === 'VISITOR' ? 'user' : m.senderType === 'AGENT' ? 'agent' : 'assistant',
        content: m.message,
        createdAt: m.createdAt,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
})
