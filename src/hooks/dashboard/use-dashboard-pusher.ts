'use client'

import { useEffect, useRef, useCallback } from 'react'
import Pusher from 'pusher-js'

function domainChannel(domainId: string) {
  return `private-domain-${domainId}`
}

function roomChannel(roomId: string) {
  return `private-room-${roomId}`
}

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
  const channelRef = useRef<string | null>(null)
  const handlersRef = useRef<PusherEventHandlers>(handlers)

  // Keep the handlers ref in sync with the latest handlers (outside render)
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  const subscribe = useCallback(
    (pusher: Pusher, targetDomainId: string, targetRoomId?: string) => {
      // Unsubscribe from previous channel
      if (channelRef.current) {
        try { pusher.unsubscribe(channelRef.current) } catch { /* ignore */ }
        channelRef.current = null
      }

      // Subscribe to domain channel for domain-scoped events
      const domainCh = domainChannel(targetDomainId)
      const domainChannelRef = pusher.subscribe(domainCh)
      channelRef.current = domainCh

      domainChannelRef.bind('client-message-created', (data: any) => {
        handlersRef.current.onMessageCreated?.({ roomId: data.roomId, messageId: data.messageId })
      })
      domainChannelRef.bind('room.updated', (data: any) => {
        if (targetRoomId && data.roomId !== targetRoomId) return
        handlersRef.current.onRoomUpdated?.({
          roomId: data.roomId,
          status: data.status,
          assignedToUserId: data.assignedToUserId ?? null,
        })
      })
      domainChannelRef.bind('handoff.requested', (data: any) => {
        if (targetRoomId && data.roomId !== targetRoomId) return
        handlersRef.current.onHandoffRequested?.({ roomId: data.roomId, status: data.status })
      })

      // Subscribe to room channel if a specific room is open
      if (targetRoomId) {
        const roomCh = roomChannel(targetRoomId)
        const roomChannelRef = pusher.subscribe(roomCh)
        channelRef.current = roomCh

        roomChannelRef.bind('message.created', (data: any) => {
          handlersRef.current.onMessageCreated?.({ roomId: data.roomId, messageId: data.messageId })
        })
        roomChannelRef.bind('room.updated', (data: any) => {
          handlersRef.current.onRoomUpdated?.({
            roomId: data.roomId,
            status: data.status,
            assignedToUserId: data.assignedToUserId ?? null,
          })
        })
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
      if (channelRef.current) {
        try { pusher.unsubscribe(channelRef.current) } catch { /* ignore */ }
      }
      pusher.disconnect()
      pusherRef.current = null
      channelRef.current = null
    }
  }, [domainId, roomId, subscribe])
}
