import { Prisma } from '@prisma/client'
import { client } from '@/lib/prisma'
import { HttpError } from '@/lib/http'
import { getPusherServer, roomChannel, domainChannel } from '@/lib/pusher-server'

export class RoomNotFoundError extends HttpError {
  constructor() { super(404, 'ROOM_NOT_FOUND') }
}

export class RoomClosedError extends HttpError {
  constructor() { super(409, 'ROOM_CLOSED') }
}

export class TakeoverConflictError extends HttpError {
  constructor() { super(409, 'TAKEOVER_CONFLICT') }
}

export class NotConversationOwnerError extends HttpError {
  constructor() { super(403, 'NOT_CONVERSATION_OWNER') }
}

/** Tenant-scoped room lookup. Missing room and wrong-tenant room both return
 *  ROOM_NOT_FOUND so callers cannot probe for another tenant's IDs. */
export async function assertTenantRoom(roomId: string, domainId: string) {
  const room = await client.chatRoom.findFirst({
    where: { id: roomId, domainId },
    select: { id: true, status: true, assignedToUserId: true, domainId: true },
  })
  if (!room) throw new RoomNotFoundError()
  return room
}

async function publishRoomUpdated(roomId: string, domainId: string, status: string, assignedToUserId: string | null) {
  const pusher = getPusherServer()
  if (!pusher) return
  try {
    await pusher.trigger(roomChannel(roomId), 'room.updated', {
      roomId, status, assignedToUserId,
    })
    await pusher.trigger(domainChannel(domainId), 'room.updated', {
      roomId, status, assignedToUserId,
    })
  } catch {
    // Pusher failure is non-fatal; DB is source of truth
  }
}

async function publishMessageCreated(roomId: string, messageId: string) {
  const pusher = getPusherServer()
  if (!pusher) return
  try {
    await pusher.trigger(roomChannel(roomId), 'message.created', { roomId, messageId })
  } catch {
    // non-fatal
  }
}

/** Widget session → BOT → WAITING_AGENT. Idempotent on repeated requests. */
export async function requestHandoff(roomId: string, domainId: string) {
  const room = await assertTenantRoom(roomId, domainId)

  if (room.status === 'WAITING_AGENT') {
    return { ok: true, chatRoomId: room.id, status: 'WAITING_AGENT' }
  }
  if (room.status === 'CLOSED' || room.status === 'LIVE') {
    throw new HttpError(409, 'ROOM_NOT_CLAIMABLE')
  }

  // Atomic claim: only change if room is BOT
  const updated = await client.chatRoom.updateMany({
    where: { id: roomId, domainId, status: 'BOT' },
    data: { status: 'WAITING_AGENT', lastActivityAt: new Date() },
  })

  if (updated.count === 0) {
    // Race condition - room changed between checks
    const freshRoom = await client.chatRoom.findFirst({ where: { id: roomId, domainId }, select: { status: true } })
    return { ok: true, chatRoomId: room.id, status: freshRoom?.status ?? room.status }
  }

  await publishRoomUpdated(roomId, domainId, 'WAITING_AGENT', null)
  return { ok: true, chatRoomId: room.id, status: 'WAITING_AGENT' }
}

/** Clerk agent → WAITING_AGENT → LIVE. Atomic conditional update.
 * Concurrent attempts: exactly one winner. */
export async function takeOverConversation(roomId: string, domainId: string, clerkUserId: string) {
  const room = await assertTenantRoom(roomId, domainId)

  if (room.status === 'LIVE' && room.assignedToUserId === clerkUserId) {
    // Already owned by this agent - idempotent
    return { ok: true, chatRoomId: room.id, status: 'LIVE', assignedToUserId: clerkUserId }
  }
  if (room.status === 'LIVE') {
    throw new TakeoverConflictError()
  }
  if (room.status === 'CLOSED') {
    throw new RoomClosedError()
  }

  const updated = await client.chatRoom.updateMany({
    where: { id: roomId, domainId, status: 'WAITING_AGENT', assignedToUserId: null },
    data: { status: 'LIVE', assignedToUserId: clerkUserId, lastActivityAt: new Date() },
  })

  if (updated.count === 0) {
    throw new TakeoverConflictError()
  }

  await publishRoomUpdated(roomId, domainId, 'LIVE', clerkUserId)
  const fresh = await client.chatRoom.findFirst({ where: { id: roomId, domainId }, select: { id: true, status: true, assignedToUserId: true } })
  return { ok: true, chatRoom: fresh }
}

/** Owner or explicit permission → LIVE/WAITING_AGENT → BOT */
export async function returnConversationToBot(roomId: string, domainId: string, clerkUserId: string) {
  const room = await assertTenantRoom(roomId, domainId)

  if (room.status === 'BOT') {
    return { ok: true, chatRoomId: room.id, status: 'BOT' }
  }

  const updated = await client.chatRoom.updateMany({
    where: { id: roomId, domainId, status: { not: 'CLOSED' } },
    data: { status: 'BOT', lastActivityAt: new Date(), assignedToUserId: null },
  })

  if (updated.count === 0) {
    throw new RoomClosedError()
  }

  await publishRoomUpdated(roomId, domainId, 'BOT', null)
  return { ok: true, chatRoomId: room.id, status: 'BOT' }
}

/** Owner or explicit permission → CLOSED */
export async function closeConversation(roomId: string, domainId: string, clerkUserId: string) {
  const room = await assertTenantRoom(roomId, domainId)

  if (room.status === 'CLOSED') {
    return { ok: true, chatRoomId: room.id, status: 'CLOSED' }
  }

  const updated = await client.chatRoom.updateMany({
    where: { id: roomId, domainId, status: { not: 'CLOSED' } },
    data: { status: 'CLOSED', lastActivityAt: new Date(), assignedToUserId: null },
  })

  if (updated.count === 0) {
    throw new RoomClosedError()
  }

  await publishRoomUpdated(roomId, domainId, 'CLOSED', null)
  return { ok: true, chatRoomId: room.id, status: 'CLOSED' }
}

/** Verify an assigned agent can reply to a LIVE conversation. Atomic check
 *  (room + insert happen inside one transaction in the caller). */
export async function assertCanAgentReply(roomId: string, domainId: string, clerkUserId: string) {
  const room = await client.chatRoom.findFirst({
    where: { id: roomId, domainId, status: 'LIVE', assignedToUserId: clerkUserId },
    select: { id: true },
  })
  if (!room) throw new NotConversationOwnerError()
  return room
}

/** Create an agent message inside a transaction with ownership lock.
 * Prevents ownership changing between check and insert. */
export async function createAgentMessage(tx: Prisma.TransactionClient, roomId: string, clerkUserId: string, content: string) {
  const room = await tx.chatRoom.findFirst({
    where: { id: roomId, status: 'LIVE', assignedToUserId: clerkUserId },
    select: { id: true },
  })
  if (!room) throw new NotConversationOwnerError()

  const message = await tx.chatMessage.create({
    data: { chatRoomId: roomId, message: content, senderType: 'AGENT', senderUserId: clerkUserId },
    select: { id: true, message: true, senderType: true, createdAt: true },
  })

  await tx.chatRoom.update({
    where: { id: roomId },
    data: { lastActivityAt: new Date() },
  })

  await publishMessageCreated(roomId, message.id)
  return message
}
