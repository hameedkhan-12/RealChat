'use client'

import { useEffect, useRef, useCallback } from 'react'
import Pusher from 'pusher-js'
import {
  CHANNEL,
  ConversationEvent,
  MessageCreatedEvent,
  RoomUpdatedEvent,
  HandoffRequestedEvent,
} from '@/lib/conversation-events'

type PusherEventHandlers = {
  onMessageCreated?: (data: { roomId: string; messageId: string }) => void
  onRoomUpdated?: (data: { roomId: string; status: string; assignedToUserId: string | null }) => void
  onHandoffRequested?: (data: { roomId: string; status: string }) => void
}

export function useDashboardPusher(
  domainId: string | undefined,
  roomId: string | undefined,
  handlers: PusherEventHandlers,
) {
  const pusherRef = useRef<Pusher | null>(null)
  const subscribedChannels = useRef<Set<string>>(new Set())
  const handlersRef = useRef<PusherEventHandlers>(handlers)

  // Keep the handlers ref in sync with the latest handlers (outside render)
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  const subscribe = useCallback(
    (pusher: Pusher, targetDomainId: string, targetRoomId?: string) => {
      // Track subscribed channels to avoid re-subscribing
      const domainCh = CHANNEL.domain(targetDomainId)

      if (!subscribedChannels.current.has(domainCh)) {
        const domainChannelRef = pusher.subscribe(domainCh)
        subscribedChannels.current.add(domainCh)

        domainChannelRef.bind('message.created', (data: MessageCreatedEvent) => {
          handlersRef.current.onMessageCreated?.({
            roomId: data.roomId,
            messageId: data.messageId,
          })
        })
        domainChannelRef.bind('room.updated', (data: RoomUpdatedEvent) => {
          if (targetRoomId && data.roomId !== targetRoomId) return
          handlersRef.current.onRoomUpdated?.({
            roomId: data.roomId,
            status: data.status,
            assignedToUserId: data.assignedToUserId ?? null,
          })
        })
        domainChannelRef.bind('handoff.requested', (data: HandoffRequestedEvent) => {
          if (targetRoomId && data.roomId !== targetRoomId) return
          handlersRef.current.onHandoffRequested?.({
            roomId: data.roomId,
            status: data.status,
          })
        })
      }

      // Subscribe to room channel if a specific room is open
      if (targetRoomId) {
        const roomCh = CHANNEL.room(targetRoomId)
        if (!subscribedChannels.current.has(roomCh)) {
          const roomChannelRef = pusher.subscribe(roomCh)
          subscribedChannels.current.add(roomCh)

          roomChannelRef.bind('message.created', (data: MessageCreatedEvent) => {
            handlersRef.current.onMessageCreated?.({
              roomId: data.roomId,
              messageId: data.messageId,
            })
          })
          roomChannelRef.bind('room.updated', (data: RoomUpdatedEvent) => {
            handlersRef.current.onRoomUpdated?.({
              roomId: data.roomId,
              status: data.status,
              assignedToUserId: data.assignedToUserId ?? null,
            })
          })
        }
      }
    },
    [],
  )

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

    if (!key || !cluster || !domainId) {
      // Pusher not configured or no domain - skip realtime
      return
    }

    if (pusherRef.current) {
      // Re-subscribe when domain/room changes
      subscribe(pusherRef.current, domainId, roomId)
      return
    }

    const pusher = new Pusher(key, {
      cluster,
      authEndpoint: '/api/pusher/auth',
      auth: {
        params: {},
      },
      disableStats: true,
      enabledTransports: ['ws', 'wss'],
    })

    pusher.connection.bind('connected', () => {
      subscribe(pusher, domainId, roomId)
    })

    pusher.connection.bind('disconnected', () => {
      // Reconnection handled automatically by pusher-js; resubscribe on reconnect
      pusher.connection.bind('connected', () => {
        subscribe(pusher, domainId, roomId)
      })
    })

    pusherRef.current = pusher

    return () => {
      const channelsCopy = Array.from(subscribedChannels.current)
      channelsCopy.forEach((channelName) => {
        try { pusher.unsubscribe(channelName) } catch { /* ignore */ }
      })
      subscribedChannels.current.clear()
      pusher.disconnect()
      pusherRef.current = null
    }
  }, [domainId, roomId, subscribe])
}
