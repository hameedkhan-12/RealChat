import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { requireDomainAccess } from '@/lib/auth'

export const POST = async (req: Request) => {
  const { domainId, chatRoomId } = await req.json()
  if (!domainId || !chatRoomId) {
    return NextResponse.json({ error: 'domainId and chatRoomId required' }, { status: 400 })
  }

  await requireDomainAccess(domainId, 'AGENT')

  const room = await client.chatRoom.findUnique({ where: { id: chatRoomId } })
  if (!room || room.domainId !== domainId) {
    return NextResponse.json({ error: 'Chat room not found' }, { status: 404 })
  }

  const user = (await requireDomainAccess(domainId, 'AGENT')).user

  const updated = await client.chatRoom.update({
    where: { id: chatRoomId },
    data: {
      status: 'LIVE',
      assignedToUserId: user.id,
      lastActivityAt: new Date(),
    },
    select: { id: true, status: true, assignedToUserId: true },
  })

  return NextResponse.json({ ok: true, chatRoom: updated })
}
