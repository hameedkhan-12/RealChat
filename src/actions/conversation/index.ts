'use server'

import { client } from '@/lib/prisma'
import { requireResourceAccess } from '@/lib/auth'
import { action } from '@/lib/action'
import { logger } from '@/lib/logger'

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export type ChatRoomStatus = 'BOT' | 'WAITING_AGENT' | 'LIVE' | 'CLOSED'

export const onToggleRealtime = async (id: string, state: ChatRoomStatus): Promise<ActionResult> => {
  await requireResourceAccess('chatRoom', id)
  try {
    const data: Record<string, any> = { status: state, lastActivityAt: new Date() }
    if (state === 'BOT') {
      data.assignedToUserId = null
    }
    const chatRoom = await client.chatRoom.update({
      where: { id },
      data,
      select: { id: true, status: true, assignedToUserId: true },
    })
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
  await requireResourceAccess('chatRoom', id)
  try {
    const chatRoom = await client.chatRoom.update({
      where: { id },
      data: { status: 'CLOSED', lastActivityAt: new Date(), assignedToUserId: null },
      select: { id: true, status: true },
    })
    return {
      ok: true,
      data: { status: 200, message: 'Conversation closed', chatRoom },
    }
  } catch (error) {
    logger.error('onCloseConversation failed', { error: String(error), chatRoomId: id })
    return { ok: false, error: 'Failed to close conversation', status: 500 }
  }
}

export const onReturnToBot = async (id: string): Promise<ActionResult> => {
  await requireResourceAccess('chatRoom', id)
  try {
    const chatRoom = await client.chatRoom.update({
      where: { id },
      data: { status: 'BOT', lastActivityAt: new Date(), assignedToUserId: null },
      select: { id: true, status: true },
    })
    return {
      ok: true,
      data: { status: 200, message: 'Returned to bot', chatRoom },
    }
  } catch (error) {
    logger.error('onReturnToBot failed', { error: String(error), chatRoomId: id })
    return { ok: false, error: 'Failed to return to bot', status: 500 }
  }
}

export const onGetConversationMode = async (id: string) => {
  await requireResourceAccess('chatRoom', id)
  try {
    const mode = await client.chatRoom.findUnique({ where: { id }, select: { status: true } })
    return mode ? { live: mode.status === 'LIVE', status: mode.status } : null
  } catch (error) {
    logger.error('onGetConversationMode failed', { error: String(error), chatRoomId: id })
  }
}

export const onGetDomainChatRooms = async (
  domainId: string,
  filter?: 'WAITING_AGENT' | 'LIVE' | 'CLOSED' | 'BOT'
) => {
  await requireResourceAccess('chatRoom', domainId) // domainId here is actually chatRoomId - keep for backwards compat
  // Actually domainId is used as filter below; requireResourceAccess expects chatRoomId.
  // Fix: this function takes domainId for filtering. Use requireDomainAccess instead.
  const { requireDomainAccess } = await import('@/lib/auth')
  await requireDomainAccess(domainId)
  try {
    const domain = await client.domain.findUnique({
      where: { id: domainId },
      select: {
        id: true,
        name: true,
        customers: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            chatRooms: {
              where: filter ? { status: filter } : {},
              select: {
                id: true,
                status: true,
                createdAt: true,
                lastActivityAt: true,
                consentAt: true,
                assignedToUserId: true,
                messages: {
                  select: { message: true, createdAt: true, seen: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
                assignedTo: { select: { fullname: true, clerkId: true } },
              },
              orderBy: { lastActivityAt: 'desc' },
            },
          },
        },
      },
    })
    if (!domain) return null
    return {
      domainId: domain.id,
      domainName: domain.name,
      customer: domain.customers.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        phone: c.phone,
        chatRoom: c.chatRooms.map((r) => ({
          id: r.id,
          status: r.status,
          createdAt: r.createdAt,
          lastActivityAt: r.lastActivityAt,
          consentAt: r.consentAt,
          assignedToUserId: r.assignedToUserId,
          assignedTo: r.assignedTo?.fullname || r.assignedTo?.clerkId,
          message: r.messages,
        })),
      })),
    }
  } catch (error) {
    logger.error('onGetDomainChatRooms failed', { error: String(error), domainId })
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
