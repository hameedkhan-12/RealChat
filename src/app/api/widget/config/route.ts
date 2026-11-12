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
    include: { domain: { include: { chatBot: true } } },
  })
  if (!room) return NextResponse.json({ error: 'Invalid session' }, { status: 403 })

  const publicConfig = {
    chatBot: room.domain.chatBot ? {
      botName: room.domain.chatBot.botName,
      welcomeMessage: room.domain.chatBot.welcomeMessage,
      avatarUrl: room.domain.chatBot.avatarUrl,
      primaryColor: room.domain.chatBot.primaryColor,
      textColor: room.domain.chatBot.textColor,
      position: room.domain.chatBot.position,
      launcherLabel: room.domain.chatBot.launcherLabel,
      borderRadius: room.domain.chatBot.borderRadius,
      privacyPolicyUrl: room.domain.chatBot.privacyPolicyUrl,
      consentText: room.domain.chatBot.consentText,
      offlineMessage: room.domain.chatBot.offlineMessage,
      showPoweredBy: room.domain.chatBot.showPoweredBy,
      bookingEnabled: room.domain.chatBot.bookingEnabled,
      handoffEnabled: room.domain.chatBot.handoffEnabled,
    } : null,
    domainName: room.domain.name,
    timezone: room.domain.timezone,
    defaultLocale: room.domain.defaultLocale,
  }

  return NextResponse.json({ ok: true, config: publicConfig, chatRoomId: room.id })
}
