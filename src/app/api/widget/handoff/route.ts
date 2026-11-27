import { NextResponse } from 'next/server'
import { handle, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireWidgetSession } from '@/lib/widget-auth'
import { sendMail } from '@/lib/mail'
import { requestHandoff } from '@/server/conversation-ownership'

export const POST = handle(async (req: Request): Promise<NextResponse> => {
  const ip = getClientIp(req)
  const rl = await rateLimit(`handoff:${ip}`, 10, 60, true)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { room } = await requireWidgetSession(req)

  // Delegate to centralized ownership service (atomic BOT → WAITING_AGENT,
  // idempotent on repeated requests, publishes after commit).
  const result = await requestHandoff(room.id, room.domainId)

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

  return NextResponse.json({ ok: true, chatRoomId: result.chatRoomId, status: result.status })
})
