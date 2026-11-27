import { NextResponse } from 'next/server'
import { handle, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireDomainAccess } from '@/lib/auth'
import { takeOverConversation } from '@/server/conversation-ownership'

export const POST = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`takeover:${ip}`, 10, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const body = await req.json()
  const { domainId, chatRoomId } = body as { domainId?: string; chatRoomId?: string }
  if (!domainId || !chatRoomId) throw new HttpError(400, 'MISSING_PARAMS')

  const { user } = await requireDomainAccess(domainId, 'AGENT')

  // Delegate to centralized ownership service (atomic WAITING_AGENT → LIVE,
  // concurrent-safe: exactly one winner).
  const result = await takeOverConversation(chatRoomId, domainId, user.id)

  return NextResponse.json({ ok: true, chatRoom: result.chatRoom })
})
