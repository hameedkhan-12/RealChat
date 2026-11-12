import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { hashToken, getBearerToken } from '@/lib/session'

export const GET = async (req: Request) => {
  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null
  if (!token) return NextResponse.json({ error: 'Missing session token' }, { status: 401 })

  const tokenHash = hashToken(token)
  const room = await client.chatRoom.findFirst({
    where: { sessionTokenHash: tokenHash },
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, senderType: true, message: true, createdAt: true, seen: true },
      },
    },
  })
  if (!room) return NextResponse.json({ error: 'Invalid session' }, { status: 403 })

  return NextResponse.json({
    ok: true,
    messages: room.messages.map((m) => ({
      ...m,
      role: m.senderType === 'VISITOR' ? 'user' : 'assistant',
    })),
  })
}
