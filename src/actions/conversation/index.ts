'use server'

import { client } from '@/lib/prisma'
import { requireResourceAccess } from '@/lib/auth'
import { logger } from '@/lib/logger'

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export const onToggleRealtime = async (id: string, state: boolean): Promise<ActionResult> => {
  await requireResourceAccess('chatRoom', id)
  try {
    const chatRoom = await client.chatRoom.update({
      where: { id },
      data: { status: state ? 'LIVE' : 'BOT' },
      select: { id: true, status: true },
    })
    return {
      ok: true,
      data: {
        status: 200,
        message: chatRoom.status === 'LIVE' ? 'Realtime mode enabled' : 'Realtime mode disabled',
        chatRoom: { ...chatRoom, live: chatRoom.status === 'LIVE' },
      },
    }
  } catch (error) {
    logger.error('onToggleRealtime failed', { error: String(error), chatRoomId: id })
    return { ok: false, error: 'Failed to toggle realtime', status: 500 }
  }
}

export const onGetConversationMode = async (id: string) => {
  await requireResourceAccess('chatRoom', id)
  try {
    const mode = await client.chatRoom.findUnique({ where: { id }, select: { status: true } })
    return mode ? { live: mode.status === 'LIVE' } : null
  } catch (error) {
    logger.error('onGetConversationMode failed', { error: String(error), chatRoomId: id })
  }
}

export const onGetDomainChatRooms = async (id: string) => {
  await requireResourceAccess('chatRoom', id)
  try {
    const domain = await client.domain.findUnique({
      where: { id },
      select: {
        customers: {
          select: {
            email: true,
            chatRooms: {
              select: {
                createdAt: true,
                id: true,
                messages: {
                  select: { message: true, createdAt: true, seen: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    })
    if (!domain) return null
    return {
      customer: domain.customers.map((c) => ({
        email: c.email,
        chatRoom: c.chatRooms.map((r) => ({
          createdAt: r.createdAt,
          id: r.id,
          message: r.messages,
        })),
      })),
    }
  } catch (error) {
    logger.error('onGetDomainChatRooms failed', { error: String(error), domainId: id })
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
      },
    })
    if (!room) return { ok: true, data: undefined }
    return {
      ok: true,
      data: [
        {
          id: room.id,
          live: room.status === 'LIVE',
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
  chatroomId: string,
  message: string,
  id: string,
  role: 'assistant' | 'user'
) => {
  // TODO(Phase 2): send via server-only Pusher on private channels
  void chatroomId; void message; void id; void role
}

export const onOwnerSendMessage = async (
  chatroom: string,
  message: string,
  role: 'assistant' | 'user'
): Promise<ActionResult> => {
  await requireResourceAccess('chatRoom', chatroom)
  try {
    const created = await client.chatMessage.create({
      data: { chatRoomId: chatroom, message, senderType: role === 'user' ? 'VISITOR' : 'AGENT' },
      select: { id: true, senderType: true, message: true, createdAt: true, seen: true },
    })
    return {
      ok: true,
      data: {
        message: [{ ...created, role: created.senderType === 'VISITOR' ? 'user' : 'assistant' }],
      },
    }
  } catch (error) {
    logger.error('onOwnerSendMessage failed', { error: String(error), chatRoomId: chatroom })
    return { ok: false, error: 'Failed to send message', status: 500 }
  }
}
