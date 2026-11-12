import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { hashToken, getBearerToken } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'

export const POST = async (req: Request) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const rl = await rateLimit(`msg:${ip}`, 60, 60)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null
  if (!token) return NextResponse.json({ error: 'Missing session token' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { content, stepKey, answer } = body || {}
  if (!content && !answer) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const tokenHash = hashToken(token)
  const room = await client.chatRoom.findFirst({ where: { sessionTokenHash: tokenHash } })
  if (!room) return NextResponse.json({ error: 'Invalid session' }, { status: 403 })

  await client.chatMessage.create({
    data: { chatRoomId: room.id, message: content ?? '', senderType: 'VISITOR' },
  })

  await client.chatRoom.update({ where: { id: room.id }, data: { lastActivityAt: new Date() } })

  return NextResponse.json({ ok: true, chatRoomId: room.id })
}
