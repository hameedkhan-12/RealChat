/**
 * Shared Pusher event types for RealChat.
 * Used by both backend publish calls and frontend channel subscriptions.
 * Only minimal event data is published over Pusher; clients must recover
 * full state from the persisted database records.
 */

/** Channel naming prefixes */
export const CHANNEL = {
  domain: (domainId: string) => `private-domain-${domainId}`,
  room: (roomId: string) => `private-room-${roomId}`,
} as const

/** Conversation lifecycle event names. Kept minimal so clients never
 *  receive private customer data over the wire. */
export type ConversationEventType =
  | 'message.created'
  | 'room.updated'
  | 'handoff.requested'

/** Minimal payload published when a new message is persisted.
 *  Clients should fetch the full message via GET /api/widget/messages
 *  (visitor) or GET /api/dashboard/conversations/:id/messages (dashboard)
 *  using the messageId to recover the complete record.
 */
export type MessageCreatedEvent = {
  type: 'message.created'
  roomId: string
  messageId: string
  senderType: 'VISITOR' | 'BOT' | 'AGENT'
}

/** Minimal payload published when conversation ownership/status changes. */
export type RoomUpdatedEvent = {
  type: 'room.updated'
  roomId: string
  status: 'BOT' | 'WAITING_AGENT' | 'LIVE' | 'CLOSED'
  assignedToUserId: string | null
}

/** Minimal payload published when a visitor requests human handoff. */
export type HandoffRequestedEvent = {
  type: 'handoff.requested'
  roomId: string
  status: 'WAITING_AGENT'
}

export type ConversationEvent = MessageCreatedEvent | RoomUpdatedEvent | HandoffRequestedEvent
