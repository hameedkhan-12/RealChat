import React, { useEffect, useState } from 'react'
import { Card } from '../ui/card'
import Pusher from 'pusher-js'
import { CHANNEL, type MessageCreatedEvent } from '@/lib/conversation-events'

type Props = {
  chatRoomId: string
  setChats: React.Dispatch<
    React.SetStateAction<
      {
        role: 'user' | 'assistant'
        content: string
        link?: string | undefined
      }[]
    >
  >
}

const RealTimeMode = ({ chatRoomId, setChats }: Props) => {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

    if (!key || !cluster || !chatRoomId) {
      return
    }

    const pusher = new Pusher(key, {
      cluster,
      authEndpoint: '/api/pusher/auth',
      auth: { params: {} },
      disableStats: true,
      enabledTransports: ['ws', 'wss'],
    })

    const roomCh = CHANNEL.room(chatRoomId)
    const channel = pusher.subscribe(roomCh)

    pusher.connection.bind('connected', () => setConnected(true))
    pusher.connection.bind('disconnected', () => setConnected(false))

    // Persist first, then publish: clients recover full state from the DB.
    channel.bind('message.created', async (data: MessageCreatedEvent) => {
      if (data.roomId !== chatRoomId) return
      try {
        // Note: In the widget iframe, the messages API requires a session token.
        // The visitor's session token is stored in localStorage by use-chatbot.
        const token = localStorage.getItem('realchat_session_token')
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch(`/api/widget/messages`, { headers })
        if (!res.ok) return
        const data = await res.json()
        const items = data?.items ?? data?.messages ?? []
        const newItem = items.find((m: any) => m.id === data.messageId)
        if (!newItem) return
        setChats((prev) => {
          if (prev.some((m) => m.content === newItem.message && m.role === newItem.senderType.toLowerCase()))
            return prev
          return [
            ...prev,
            {
              role: newItem.senderType === 'VISITOR' ? 'user' : 'assistant',
              content: newItem.message,
              link: undefined,
            },
          ]
        })
      } catch {
        // Non-fatal; message is persisted in the DB
      }
    })

    return () => {
      channel.unbind()
      pusher.disconnect()
    }
  }, [chatRoomId, setChats])

  return (
    <Card className={`px-3 rounded-full py-1 bg-${connected ? 'green' : 'amber'} font-bold text-white text-sm`}>
      {connected ? 'Real Time' : 'Real Time (disconnected)'}
    </Card>
  )
}

export default RealTimeMode
