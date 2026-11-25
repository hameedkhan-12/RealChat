import 'server-only'
import { NextResponse } from 'next/server'
import { handle, readJson, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireWidgetSession } from '@/lib/widget-auth'
import { getBearerToken } from '@/lib/session'
import { z } from 'zod'
import { getEnv } from '@/env'
import { pusherAuthSignature } from '@/lib/pusher-server'
import { currentUser } from '@clerk/nextjs/server'
import { client } from '@/lib/prisma'

async function readForm(req: Request, schema: z.ZodTypeAny): Promise<{ socketId: string; channelName: string }> {
  const ct = (req.headers.get('content-type') ?? '').toLowerCase()
  let raw: { socket_id?: string; channel_name?: string }
  if (ct.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData()
    raw = { socket_id: form.get('socket_id')?.toString(), channel_name: form.get('channel_name')?.toString() }
  } else {
    raw = await readJson(req, z.object({ socket_id: z.string(), channel_name: z.string() }))
  }
  const parsed = schema.safeParse({ socketId: raw.socket_id, channelName: raw.channel_name })
  if (!parsed.success) throw new HttpError(400, 'VALIDATION')
  return parsed.data as { socketId: string; channelName: string }
}

/** Only these private channel patterns are authorized. Anything else is rejected. */
function parseChannel(channelName: string): { kind: 'room'; roomId: string } | { kind: 'domain'; domainId: string } | null {
  const m = channelName.match(/^private-room-(.+)$/)
  if (m) return { kind: 'room', roomId: m[1] }
  const d = channelName.match(/^private-domain-(.+)$/)
  if (d) return { kind: 'domain', domainId: d[1] }
  return null
}

export const POST = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`pusher:auth:${ip}`, 60, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { socketId, channelName } = await readForm(req, z.object({
    socketId: z.string(),
    channelName: z.string(),
  }))

  const channel = parseChannel(channelName)
  if (!channel) throw new HttpError(403, 'FORBIDDEN_CHANNEL')

  const env = getEnv()
  const secret = env.PUSHER_SECRET
  if (!secret) throw new HttpError(500, 'PUSHER_NOT_CONFIGURED')

  // Widget visitor: bearer session token proves room ownership
  const token = getBearerToken(req)
  if (token) {
    const { room } = await requireWidgetSession(req)
    if (channel.kind !== 'room' || channel.roomId !== room.id) {
      throw new HttpError(403, 'FORBIDDEN_CHANNEL')
    }
    const signature = pusherAuthSignature(secret, socketId, channelName)
    return NextResponse.json({ auth: `${env.PUSHER_KEY}:${signature}` })
  }

  // Dashboard agent: Clerk identity + server-side tenant membership
  const clerk = await currentUser()
  if (!clerk) throw new HttpError(401, 'UNAUTHORIZED')
  const user = await client.user.findUnique({ where: { clerkId: clerk.id } })
  if (!user) throw new HttpError(401, 'UNAUTHORIZED')

  if (channel.kind === 'room') {
    const room = await client.chatRoom.findUnique({
      where: { id: channel.roomId },
      select: { id: true, domainId: true },
    })
    if (!room) throw new HttpError(403, 'FORBIDDEN_CHANNEL') // do not leak room existence
    const membership = await client.domainMember.findUnique({
      where: { domainId_userId: { domainId: room.domainId, userId: user.id } },
    })
    if (!membership) throw new HttpError(403, 'FORBIDDEN_CHANNEL')
  } else {
    const membership = await client.domainMember.findUnique({
      where: { domainId_userId: { domainId: channel.domainId, userId: user.id } },
    })
    if (!membership) throw new HttpError(403, 'FORBIDDEN_CHANNEL')
  }

  const signature = pusherAuthSignature(secret, socketId, channelName)
  return NextResponse.json({ auth: `${env.PUSHER_KEY}:${signature}` })
})
