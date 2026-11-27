'use server'

import { client } from '@/lib/prisma'
import { requireDomainAccess, requireResourceAccess, requireUser } from '@/lib/auth'
import { action } from '@/lib/action'
import { logger } from '@/lib/logger'
import { HttpError } from '@/lib/errors'
import {
  requestHandoff,
  takeOverConversation,
  returnConversationToBot,
  closeConversation,
  assertCanAgentReply,
  createAgentMessage,
  RoomNotFoundError,
  TakeoverConflictError,
  NotConversationOwnerError,
  RoomClosedError,
} from '@/server/conversation-ownership'

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export type ChatRoomStatus = 'BOT' | 'WAITING_AGENT' | 'LIVE' | 'CLOSED'

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

export const onRequestHandoff = async (roomId: string): Promise<ActionResult> => {
  const access = await requireResourceAccess('chatRoom', roomId)
  try {
    const result = await requestHandoff(roomId, access.domainId)
    return { ok: true, data: result }
  } catch (e) {
    if (e instanceof RoomNotFoundError) return { ok: false, error: e.code, status: 404 }
    if (e instanceof HttpError) return { ok: false, error: e.code, status: e.status }
    logger.error('onRequestHandoff failed', { error: String(e), roomId })
    return { ok: false, error: 'Failed to request handoff', status: 500 }
  }
}

export const onTakeoverConversation = async (roomId: string): Promise<ActionResult> => {
  const { user } = await requireUser()
  const access = await requireResourceAccess('chatRoom', roomId)
  try {
    const result = await takeOverConversation(roomId, access.domainId, user.id)
    return { ok: true, data: result }
  } catch (e) {
    if (e instanceof RoomNotFoundError) return { ok: false, error: e.code, status: 404 }
    if (e instanceof RoomClosedError) return { ok: false, error: e.code, status: 409 }
    if (e instanceof TakeoverConflictError) return { ok: false, error: e.code, status: 409 }
    if (e instanceof HttpError) return { ok: false, error: e.code, status: e.status }
    logger.error('onTakeoverConversation failed', { error: String(e), roomId })
    return { ok: false, error: 'Failed to take over conversation', status: 500 }
  }
}

export const onCloseConversation = async (id: string): Promise<ActionResult> => {
  const { user } = await requireUser()
  const access = await requireResourceAccess('chatRoom', id)
  try {
    const result = await closeConversation(id, access.domainId, user.id)
    return { ok: true, data: result }
  } catch (e) {
    if (e instanceof RoomClosedError) return { ok: true, data: { status: 'CLOSED' } }
    if (e instanceof RoomNotFoundError) return { ok: false, error: e.code, status: 404 }
    if (e instanceof HttpError) return { ok: false, error: e.code, status: e.status }
    logger.error('onCloseConversation failed', { error: String(e), chatRoomId: id })
    return { ok: false, error: 'Failed to close conversation', status: 500 }
  }
}

export const onReturnToBot = async (id: string): Promise<ActionResult> => {
  const { user } = await requireUser()
  const access = await requireResourceAccess('chatRoom', id)
  try {
    const result = await returnConversationToBot(id, access.domainId, user.id)
    return { ok: true, data: result }
  } catch (e) {
    if (e instanceof RoomClosedError) return { ok: false, error: e.code, status: 409 }
    if (e instanceof RoomNotFoundError) return { ok: false, error: e.code, status: 404 }
    if (e instanceof HttpError) return { ok: false, error: e.code, status: e.status }
    logger.error('onReturnToBot failed', { error: String(e), chatRoomId: id })
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

export const onOwnerSendMessage = async (
  domainId: string,
  chatroom: string,
  message: string
): Promise<ActionResult> => {
  const { user } = await requireDomainAccess(domainId, 'AGENT')
  try {
    // Atomic: ownership check + message insert in one transaction
    const created = await client.$transaction(async (tx) => {
      await assertCanAgentReply(chatroom, domainId, user.id)
      return createAgentMessage(tx, chatroom, user.id, message)
    })
    return {
      ok: true,
      data: {
        message: [{ ...created, role: 'assistant' }],
      },
    }
  } catch (e) {
    if (e instanceof NotConversationOwnerError) return { ok: false, error: e.code, status: 403 }
    if (e instanceof HttpError) return { ok: false, error: e.code, status: e.status }
    logger.error('onOwnerSendMessage failed', { error: String(e), chatRoomId: chatroom })
    return { ok: false, error: 'Failed to send message', status: 500 }
  }
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

  // Cursor-based pagination: (lastActivityAt DESC, id ASC) lexicographic predicate
  if (cursor) {
    const [lastActivityAt, id] = cursor.split('|')
    where.OR = [
      { lastActivityAt: { lt: new Date(lastActivityAt) } },
      { lastActivityAt: new Date(lastActivityAt), id: { gt: id } },
    ]
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
        items: items.map((r) => ({
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

export const onGetChatMessages = async (
  id: string,
  cursor?: string,
  limit = 50
): Promise<ActionResult> => {
  await requireResourceAccess('chatRoom', id)

  const parsedLimit = Math.min(Math.max(limit, 1), 100)

  const where: any = { chatRoomId: id }

  // Cursor-based pagination: (createdAt ASC, id ASC) lexicographic predicate
  if (cursor) {
    const [createdAt, msgId] = cursor.split('|')
    where.OR = [
      { createdAt: { gt: new Date(createdAt) } },
      { createdAt: new Date(createdAt), id: { gt: msgId } },
    ]
  }

  try {
    const room = await client.chatRoom.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        customer: { select: { email: true, name: true, phone: true } },
        messages: {
          select: { id: true, senderType: true, message: true, createdAt: true, seen: true },
          where,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: parsedLimit + 1,
        },
      },
    })
    if (!room) return { ok: true, data: undefined }

    const hasMore = room.messages.length > parsedLimit
    const items = hasMore ? room.messages.slice(0, parsedLimit) : room.messages
    const nextCursor = hasMore
      ? `${items[parsedLimit - 1].createdAt.toISOString()}|${items[parsedLimit - 1].id}`
      : null

    return {
      ok: true,
      data: [
        {
          id: room.id,
          status: room.status,
          customer: room.customer,
          message: items.map((m) => ({
            ...m,
            role: m.senderType === 'VISITOR' ? 'user' : 'assistant',
          })),
          nextCursor,
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
        chatRooms: { select: { id: true, status: true, createdAt: true, flowCompletedAt: true } },
      },
    })
    if (!customer) return { ok: false, error: 'FORBIDDEN', status: 403 }
    return { ok: true, data: customer }
  })
}
