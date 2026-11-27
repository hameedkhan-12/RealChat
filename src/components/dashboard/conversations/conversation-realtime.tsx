'use client'

import { useEffect, useState, useRef } from 'react'
import { ConversationTranscript } from '@/components/dashboard/conversations/conversation-transcript'
import { MessageComposer } from '@/components/dashboard/conversations/message-composer'
import { useDashboardPusher } from '@/hooks/dashboard/use-dashboard-pusher'
import type { MessageCreatedEvent } from '@/lib/conversation-events'

type Message = {
  id: string
  senderType: 'VISITOR' | 'BOT' | 'AGENT'
  message: string
  createdAt: Date
  seen: boolean
  senderUserId: string | null
}

type Props = {
  conversationId: string
  domainId: string
  status: string
  assignedToUserId: string | null
  initialMessages: Message[]
  disabled: boolean
}

export function ConversationRealtime({
  conversationId,
  domainId,
  status,
  assignedToUserId,
  initialMessages,
  disabled,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [realtimeConnected, setRealtimeConnected] = useState(true)
  const [statusNotice, setStatusNotice] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const pendingMessageIds = useRef<Set<string>>(new Set())

  const handlers = {
    onMessageCreated: async (data: { roomId: string; messageId: string }) => {
      if (data.roomId !== conversationId) return
      // Deduplicate by messageId
      if (pendingMessageIds.current.has(data.messageId)) return
      pendingMessageIds.current.add(data.messageId)

      setFetching(true)
      try {
        // Persist first, then publish: clients recover full state from the
        // persisted message record via the messages API.
        const res = await fetch(`/api/dashboard/conversations/${conversationId}/messages`)
        if (!res.ok) return
        const data = await res.json()
        const items = data?.items ?? data?.messages ?? []
        const newItem = items.find((m: any) => m.id === data.messageId)
        if (!newItem) return

        const msg: Message = {
          id: newItem.id,
          senderType: newItem.senderType as Message['senderType'],
          message: newItem.message,
          createdAt: new Date(newItem.createdAt),
          seen: newItem.seen ?? false,
          senderUserId: newItem.senderUserId ?? null,
        }
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      } catch {
        // Non-fatal; message is persisted in the DB regardless
      } finally {
        setFetching(false)
      }
    },
    onRoomUpdated: (data: { roomId: string; status: string; assignedToUserId: string | null }) => {
      if (data.roomId !== conversationId) return
      setStatusNotice(`Conversation status updated to ${data.status}`)
    },
    onHandoffRequested: (data: { roomId: string; status: string }) => {
      if (data.roomId !== conversationId) return
      setStatusNotice('Handoff requested — conversation is waiting for an agent')
    },
  }

  useDashboardPusher(domainId, conversationId, {
    onMessageCreated: (data) => handlers.onMessageCreated(data),
    onRoomUpdated: (data) => handlers.onRoomUpdated(data),
    onHandoffRequested: (data) => handlers.onHandoffRequested(data),
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {statusNotice && (
          <div className="p-2 rounded bg-amber-50 text-amber-700 text-xs text-center border border-amber-100 mb-2">
            {statusNotice}
          </div>
        )}
        {messages.length === 0 && realtimeConnected && !fetching ? (
          <div className="flex items-center justify-center text-muted-foreground text-sm p-8">
            No messages yet
          </div>
        ) : (
          <>
            <ConversationTranscript
              messages={messages}
              assignedAgentId={assignedToUserId}
            />
            {fetching && (
              <div className="text-[10px] text-muted-foreground text-center mt-2">
                Receiving new message…
              </div>
            )}
          </>
        )}
      </div>
      <div className="border-t p-3 bg-muted/50">
        {status === 'LIVE' && assignedToUserId ? (
          <MessageComposer
            conversationId={conversationId}
            domainId={domainId}
            disabled={disabled}
          />
        ) : (
          <div className="p-4 text-xs text-muted-foreground text-center bg-muted/50">
            {status !== 'LIVE'
              ? 'Agent replies are only available when the conversation is LIVE.'
              : 'You are not the assigned agent for this conversation.'}
          </div>
        )}
      </div>
    </div>
  )
}
