'use server'

import { client } from '@/lib/prisma'

export const onToggleRealtime = async (id: string, state: boolean) => {
  try {
    const chatRoom = await client.chatRoom.update({
      where: { id },
      data: { status: state ? 'LIVE' : 'BOT' },
      select: { id: true, status: true },
    })
    return {
      status: 200,
      message: chatRoom.status === 'LIVE' ? 'Realtime mode enabled' : 'Realtime mode disabled',
      chatRoom: { ...chatRoom, live: chatRoom.status === 'LIVE' },
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetConversationMode = async (id: string) => {
  try {
    const mode = await client.chatRoom.findUnique({ where: { id }, select: { status: true } })
    return mode ? { live: mode.status === 'LIVE' } : null
  } catch (error) {
    console.log(error)
  }
}

export const onGetDomainChatRooms = async (id: string) => {
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
    console.log(error)
  }
}

export const onGetChatMessages = async (id: string) => {
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
    if (!room) return undefined
    return [
      {
        id: room.id,
        live: room.status === 'LIVE',
        message: room.messages.map((m) => ({
          ...m,
          role: m.senderType === 'VISITOR' ? 'user' : 'assistant',
        })),
      },
    ]
  } catch (error) {
    console.log(error)
  }
}

export const onViewUnReadMessages = async (id: string) => {
  try {
    await client.chatMessage.updateMany({ where: { chatRoomId: id }, data: { seen: true } })
  } catch (error) {
    console.log(error)
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
) => {
  try {
    const created = await client.chatMessage.create({
      data: { chatRoomId: chatroom, message, senderType: role === 'user' ? 'VISITOR' : 'AGENT' },
      select: { id: true, senderType: true, message: true, createdAt: true, seen: true },
    })
    return {
      message: [{ ...created, role: created.senderType === 'VISITOR' ? 'user' : 'assistant' }],
    }
  } catch (error) {
    console.log(error)
  }
}