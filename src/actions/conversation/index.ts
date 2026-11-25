'use server'

import { client } from '@/lib/prisma'
import { requireDomainAccess, requireResourceAccess } from '@/lib/auth'
import { action } from '@/lib/action'
import { logger } from '@/lib/logger'
import { getPusherServer, roomChannel } from '@/lib/pusher-server'

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export type ChatRoomStatus = 'BOT' | 'WAITING_AGENT' | 'LIVE' | 'CLOSED'

export const onToggleRealtime = async (id: string, state: ChatRoomStatus): Promise<ActionResult> => {
  const access = await requireResourceAccess('chatRoom', id)
  const domainId = access.domainId
  try {
    const data: Record<string, any> = { status: state, lastActivityAt: new Date() }
    if (state === 'BOT') {
      data.assignedToUserId = null
    }

    // Atomic update: only change if room is not already CLOSED
    const updated = await client.chatRoom.updateMany({
      where: {
        id,
        domainId,
        status: { not: 'CLOSED' },
      },
      data,
    })

    if (updated.count === 0) {
      // Room not found, wrong domain, or already CLOSED
      const existing = await client.chatRoom.findUnique({ where: { id } })
      if (!existing || existing.domainId !== domainId) {
        return { ok: false, error: 'FORBIDDEN', status: 403 }
      }
      // Already in target state - idempotent
      return {
        ok: true,
        data: {
          status: 200,
          message: `Room already ${state}`,
          chatRoom: { ...existing, live: existing.status === 'LIVE' },
        },
      }
    }

    const chatRoom = await client.chatRoom.findUnique({
      where: { id },
      select: { id: true, status: true, assignedToUserId: true },
    })
    if (!chatRoom) {
      return { ok: false, error: 'FORBIDDEN', status: 403 }
    }
    // Publish realtime event
    const pusher = getPusherServer()
    if (pusher) {
      try {
        await pusher.trigger(roomChannel(id), 'room.updated', {
          roomId: id,
          status: chatRoom.status,
          assignedToUserId: chatRoom.assignedToUserId,
        })
      } catch {
        // non-fatal
      }
    }
    return {
      ok: true,
      data: {
        status: 200,
        message: `Room set to ${state}`,
        chatRoom: { ...chatRoom, live: chatRoom.status === 'LIVE' },
      },
    }
  } catch (error) {
    logger.error('onToggleRealtime failed', { error: String(error), chatRoomId: id })
    return { ok: false, error: 'Failed to update room status', status: 500 }
  }
}

export const onCloseConversation = async (id: string): Promise<ActionResult> => {
  const access = await requireResourceAccess('chatRoom', id)
  const domainId = access.domainId
  try {
    const updated = await client.chatRoom.updateMany({
      where: {
        id,
        domainId,
        status: { not: 'CLOSED' },
      },
      data: {
        status: 'CLOSED',
        lastActivityAt: new Date(),
        assignedToUserId: null,
      },
    })

    if (updated.count === 0) {
      const existing = await client.chatRoom.findUnique({ where: { id } })
      if (!existing || existing.domainId !== domainId) {
        return { ok: false, error: 'FORBIDDEN', status: 403 }
      }
      // Already closed - idempotent
      return {
        ok: true,
        data: {
          status: 200,
          message: 'Room already closed',
          chatRoom: { ...existing, status: 'CLOSED' },
        },
      }
    }

    const room = await client.chatRoom.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    const pusher = getPusherServer()
    if (pusher) {
      try {
        await pusher.trigger(roomChannel(id), 'room.updated', {
          roomId: id,
          status: 'CLOSED',
          assignedToUserId: null,
        })
      } catch {
        // non-fatal
      }
    }
    return {
      ok: true,
      data: {
        status: 200,
        message: 'Conversation closed',
        chatRoom: room,
      },
    }
  } catch (error) {
    logger.error('onCloseConversation failed', { error: String(error), chatRoomId: id })
    return { ok: false, error: 'Failed to close conversation', status: 500 }
  }
}

export const onReturnToBot = async (id: string): Promise<ActionResult> => {
  const access = await requireResourceAccess('chatRoom', id)
  const domainId = access.domainId
  try {
    const updated = await client.chatRoom.updateMany({
      where: {
        id,
        domainId,
        status: { not: 'CLOSED' },
      },
      data: {
        status: 'BOT',
        lastActivityAt: new Date(),
        assignedToUserId: null,
      },
    })

    if (updated.count === 0) {
      const existing = await client.chatRoom.findUnique({ where: { id } })
      if (!existing || existing.domainId !== domainId) {
        return { ok: false, error: 'FORBIDDEN', status: 403 }
      }
      return {
        ok: true,
        data: {
          status: 200,
          message: 'Room already BOT',
          chatRoom: { ...existing, status: 'BOT' },
        },
      }
    }

    const room = await client.chatRoom.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    const pusher = getPusherServer()
    if (pusher) {
      try {
        await pusher.trigger(roomChannel(id), 'room.updated', {
          roomId: id,
          status: 'BOT',
          assignedToUserId: null,
        })
      } catch {
        // non-fatal
      }
    }
    return {
      ok: true,
      data: {
        status: 200,
        message: 'Returned to bot',
        chatRoom: room,
      },
    }
  } catch (error) {
    logger.error('onReturnToBot failed', { error: String(error), chatRoomId: id })
    return { ok: false, error: 'Failed to return to bot', status: 500 }
  }
}

export const onGetConversationMode = async (id: string) => {
  await requireResourceAccess('chatRoom', id)
  try {
    const chatRoom = await client.chatRoom.findUnique({ where: { id }, select: { status: true } })
    return chatRoom ? { live: chatRoom.status === 'LIVE', status: chatRoom.status } : null
  } catch (error) {
    logger.error('onGetConversationMode failed', { error: String(error), chatRoomId: id })
  }
}

export type ChatRoomItem = {
  id: string
  status: string
  createdAt: Date
  lastActivityAt: Date | null
  consentAt: Date | null
  flowCompletedAt: Date | null
  pageUrl: string | null
  customer: {
    id: string
    email: string | null
    name: string | null
    phone: string | null
  }
  assignedToUserId: string | null
  latestMessage: string | null
}

export const onGetDomainChatRooms = async (
  domainId: string,
  filter?: 'WAITING_AGENT' | 'LIVE' | 'CLOSED' | 'BOT',
  search?: string,
  cursor?: string,
  limit = 20
): Promise<ActionResult<{ items: ChatRoomItem[]; nextCursor: string | null }>> => {
  await requireDomainAccess(domainId)

  const parsedLimit = Math.min(Math.max(limit, 1), 50)

  const where: any = { domainId }
  if (filter) where.status = filter
  if (search) {
    where.customer = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }
  }

  // Cursor-based pagination: (lastActivityAt, id)
  if (cursor) {
    const [lastActivityAt, id] = cursor.split('|')
    where.lastActivityAt = { lte: new Date(lastActivityAt) }
    where.id = { gt: id }
  }

  try {
    const rooms = await client.chatRoom.findMany({
      where,
      orderBy: [{ lastActivityAt: 'desc' }, { id: 'asc' }],
      take: parsedLimit + 1,
      select: {
        id: true,
        status: true,
        createdAt: true,
        lastActivityAt: true,
        consentAt: true,
        flowCompletedAt: true,
        pageUrl: true,
        assignedToUserId: true,
        customer: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
          },
        },
        messages: {
          select: { id: true, senderType: true, message: true, createdAt: true, seen: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    const hasMore = rooms.length > parsedLimit
    const items = hasMore ? rooms.slice(0, parsedLimit) : rooms
    const nextCursor = hasMore
      ? `${items[parsedLimit - 1].lastActivityAt.toISOString()}|${items[parsedLimit - 1].id}`
      : null

    return {
      ok: true,
      data: {
        items: rooms.map((r) => ({
          id: r.id,
          status: r.status,
          createdAt: r.createdAt,
          lastActivityAt: r.lastActivityAt,
          consentAt: r.consentAt,
          flowCompletedAt: r.flowCompletedAt,
          pageUrl: r.pageUrl,
          customer: r.customer,
          assignedToUserId: r.assignedToUserId,
          latestMessage: r.messages[0]?.message || null,
        })),
        nextCursor,
      },
    }
  } catch (error) {
    logger.error('onGetDomainChatRooms failed', { error: String(error), domainId })
    return { ok: false, error: 'Failed to load conversations', status: 500 }
  }
}

export const onGetChatMessages = async (id: string): Promise<ActionResult> => {
  await requireResourceAccess('chatRoom', id)
  try {
    const room = await client.chatRoom.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        messages: {
          select: { id: true, senderType: true, message: true, createdAt: true, seen: true },
          orderBy: { createdAt: 'asc' },
        },
        customer: { select: { email: true, name: true, phone: true } },
      },
    })
    if (!room) return { ok: true, data: undefined }
    return {
      ok: true,
      data: [
        {
          id: room.id,
          status: room.status,
          customer: room.customer,
          message: room.messages.map((m) => ({
            ...m,
            role: m.senderType === 'VISITOR' ? 'user' : 'assistant',
          })),
        },
      ],
    }
  } catch (error) {
    logger.error('onGetChatMessages failed', { error: String(error), chatRoomId: id })
    return { ok: false, error: 'Failed to load messages', status: 500 }
  }
}

export const onViewUnReadMessages = async (id: string) => {
  await requireResourceAccess('chatRoom', id)
  try {
    await client.chatMessage.updateMany({ where: { chatRoomId: id }, data: { seen: true } })
  } catch (error) {
    logger.error('onViewUnReadMessages failed', { error: String(error), chatRoomId: id })
  }
}

export const onRealTimeChat = async (
  chatRoom: string,
  message: string,
  id: string,
  role: 'assistant' | 'user'
) => {
  // TODO(Phase 2): send via server-only Pusher on private channels
  void chatRoom; void message; void id; void role
}

export const onOwnerSendMessage = async (
  domainId: string,
  chatroom: string,
  message: string
): Promise<ActionResult> => {
  const { user } = await requireDomainAccess(domainId, 'AGENT')
  try {
    // Verify the room belongs to this domain and is LIVE
    const room = await client.chatRoom.findUnique({
      where: { id: chatroom },
      select: { id: true, domainId: true, status: true, assignedToUserId: true },
    })
    if (!room || room.domainId !== domainId) {
      return { ok: false, error: 'FORBIDDEN', status: 403 }
    }
    // Only allow messaging in LIVE conversations
    if (room.status !== 'LIVE') {
      return { ok: false, error: 'ROOM_NOT_ACTIVE', status: 409 }
    }
    // Only the assigned agent can send messages - atomic update
    const updated = await client.chatRoom.updateMany({
      where: {
        id: chatroom,
        domainId,
        status: 'LIVE',
        assignedToUserId: user.id,
      },
      data: {
        lastActivityAt: new Date(),
      },
    })

    if (updated.count === 0) {
      return { ok: false, error: 'FORBIDDEN', status: 403 }
    }

    // Sender type is ALWAYS AGENT - never trust client-supplied role
    const created = await client.chatMessage.create({
      data: {
        chatRoomId: chatroom,
        message,
        senderType: 'AGENT',
        senderUserId: user.id,
      },
      select: { id: true, message: true, senderType: true, createdAt: true },
    })

    // Publish realtime event
    const pusher = getPusherServer()
    if (pusher) {
      try {
        await pusher.trigger(roomChannel(chatroom), 'message.created', {
          roomId: chatroom,
          messageId: created.id,
        })
      } catch {
        // non-fatal
      }
    }
    return {
      ok: true,
      data: {
        message: [{ ...created, role: 'assistant' }],
      },
    }
  } catch (error) {
    logger.error('onOwnerSendMessage failed', { error: String(error), chatRoomId: chatroom })
    return { ok: false, error: 'Failed to send message', status: 500 }
  }
}

export const onGetCustomerAnswers = async (customerId: string): Promise<ActionResult> => {
  return action(async () => {
    const access = await requireResourceAccess('customer', customerId, 'AGENT')
    const customer = await client.customer.findUnique({
      where: { id: customerId, domainId: access.domainId },
      select: {
        email: true,
        name: true,
        phone: true,
        consentAt: true,
        questions: { select: { id: true, question: true, answered: true, stepKey: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        chatRooms: { select: { id: true, status: true, createdAt: true } },
      },
    })
    if (!customer) return { ok: false, error: 'FORBIDDEN', status: 403 }
    return { ok: true, data: customer }
  })
}