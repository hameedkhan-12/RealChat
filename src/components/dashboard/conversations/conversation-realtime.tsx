'use client'

import { useEffect, useState } from 'react'
import { ConversationTranscript } from '@/components/dashboard/conversations/conversation-transcript'
import { MessageComposer } from '@/components/dashboard/conversations/message-composer'
import { useDashboardPusher } from '@/hooks/dashboard/use-dashboard-pusher'

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

  const handlers = {
    onMessageCreated: (data: { roomId: string; messageId: string }) => {
      if (data.roomId !== conversationId) return
      setMessages((prev) => [
        ...prev,
        {
          id: `pending-${data.messageId}`,
          senderType: 'AGENT',
          message: '',
          createdAt: new Date(),
          seen: false,
          senderUserId: null,
        },
      ])
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
        {messages.length === 0 && realtimeConnected ? (
          <div className="flex items-center justify-center text-muted-foreground text-sm p-8">
            No messages yet
          </div>
        ) : (
          <>
            <ConversationTranscript
              messages={messages}
              assignedAgentId={assignedToUserId}
            />
            {messages.some((m) => m.id.startsWith('pending-')) && (
              <div className="text-[10px] text-muted-foreground text-center mt-2">
                New message received — refresh to see content
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
