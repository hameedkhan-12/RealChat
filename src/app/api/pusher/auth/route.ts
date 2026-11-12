import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { hashToken } from '@/lib/session'

export const POST = async (req: Request) => {
  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null
  const socketId = (await req.json().catch(() => ({}))).socket_id || null
  const channelName = (await req.json().catch(() => ({}))).channel_name || null

  const pusherKey = process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY
  const pusherSecret = process.env.PUSHER_SECRET
  const pusherAppId = process.env.PUSHER_APP_ID

  if (!pusherKey || !pusherSecret || !pusherAppId) {
    return NextResponse.json({ error: 'Pusher not configured' }, { status: 500 })
  }
  if (!token || !socketId || !channelName) {
    return NextResponse.json({ error: 'Missing auth params' }, { status: 400 })
  }

  const tokenHash = hashToken(token)
  const room = await client.chatRoom.findFirst({
    where: { sessionTokenHash: tokenHash },
    select: { id: true, domainId: true },
  })
  if (!room) return NextResponse.json({ error: 'Invalid session' }, { status: 403 })

  // Visitor may subscribe to their own room channel only
  const allowedChannel = `private-room-${room.id}`
  if (channelName !== allowedChannel) return NextResponse.json({ error: 'Forbidden channel' }, { status: 403 })

  const authString = `${pusherKey}:${socketId}:${channelName}`
  // Use pusher secret for signature; minimal valid auth for private channel subscription
  const crypto = require('crypto')
  const signature = crypto.createHmac('sha256', pusherSecret).update(authString).digest('hex')

  return NextResponse.json({ auth: `${pusherKey}:${signature}` })
}
