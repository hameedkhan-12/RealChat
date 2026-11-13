import { NextResponse } from 'next/server'
import { handle, readJson, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { currentUser } from '@clerk/nextjs/server'
import { z } from 'zod'
import { client } from '@/lib/prisma'
import { hashToken } from '@/lib/session'
import { pusherAuthSignature } from '@/lib/pusher-server'
import { getEnv } from '@/env'

/** Pusher-js sends application/x-www-form-urlencoded; also accept JSON. */
async function readForm(req: Request): Promise<{ socketId?: string; channelName?: string }> {
  const ct = (req.headers.get('content-type') ?? '').toLowerCase()
  if (ct.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData()
    return {
      socketId: form.get('socket_id')?.toString() ?? undefined,
      channelName: form.get('channel_name')?.toString() ?? undefined,
    }
  }
  const body = await readJson(req, z.object({ socketId: z.string().optional(), channelName: z.string().optional() }), 4096)
  return { socketId: body.socketId, channelName: body.channelName }
}

export const POST = handle(async (req: Request) => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`pusher:auth:${ip}`, 60, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { socketId, channelName } = await readForm(req)
  if (!socketId || !channelName) throw new HttpError(400, 'MISSING_PARAMS')

  const env = getEnv()
  if (!env.PUSHER_APP_ID || !env.PUSHER_KEY || !env.PUSHER_SECRET || !env.PUSHER_CLUSTER) {
    throw new HttpError(500, 'PUSHER_NOT_CONFIGURED')
  }

  // Determine the subscriber: dashboard agent (Clerk) or widget visitor (session bearer token)
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null
  const clerk = await currentUser()

  if (clerk) {
    // Dashboard agent: must be a member of the domain owning the channel
    const user = await client.user.findUnique({ where: { clerkId: clerk.id } })
    if (!user) throw new HttpError(401, 'UNAUTHORIZED')
    const m = channelName.match(/^private-domain-(.+)$/)
    if (m) {
      const domainId = m[1]
      const membership = await client.domainMember.findUnique({
        where: { domainId_userId: { domainId, userId: user.id } },
      })
      if (!membership) throw new HttpError(403, 'FORBIDDEN_CHANNEL')
    } else {
      const m2 = channelName.match(/^private-room-(.+)$/)
      if (m2) {
        const room = await client.chatRoom.findUnique({ where: { id: m2[1] }, select: { domainId: true } })
        if (!room) throw new HttpError(403, 'FORBIDDEN_CHANNEL')
        const membership = await client.domainMember.findUnique({
          where: { domainId_userId: { domainId: room.domainId, userId: user.id } },
        })
        if (!membership) throw new HttpError(403, 'FORBIDDEN_CHANNEL')
      }
    }
  } else if (token) {
    // Widget visitor: must own the room channel
    const room = await client.chatRoom.findUnique({
      where: { sessionTokenHash: hashToken(token) },
      select: { id: true, domainId: true },
    })
    if (!room) throw new HttpError(401, 'INVALID_SESSION')
    const allowed = `private-room-${room.id}`
    if (channelName !== allowed) throw new HttpError(403, 'FORBIDDEN_CHANNEL')
  } else {
    throw new HttpError(401, 'UNAUTHORIZED')
  }

  const signature = pusherAuthSignature(env.PUSHER_SECRET, socketId, channelName)
  return NextResponse.json({ auth: `${env.PUSHER_KEY}:${signature}` })
})
