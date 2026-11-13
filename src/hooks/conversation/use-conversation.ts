'use client'

import {
  onGetChatMessages,
  onGetConversationMode,
  onGetDomainChatRooms,
  onOwnerSendMessage,
  onRealTimeChat,
  onToggleRealtime,
  onViewUnReadMessages,
  onCloseConversation,
  onReturnToBot,
} from '@/actions/conversation'
import { useChatContext } from '@/context/user-chat-context'
import { getMonthName } from '@/lib/utils'
import { ChatBotMessageSchema, ConversationSearchSchema } from '@/schemas/conversation.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

type ChatMsg = { message: string; id: string; role: 'assistant' | 'user' | null; createdAt: Date; seen: boolean }

export const useConversation = (domains?: { name: string; id: string; icon: string }[]) => {
  const { register, watch, setValue } = useForm({
    resolver: zodResolver(ConversationSearchSchema) as any,
    mode: 'onChange',
  })
  const { setLoading: loadMessages, setChats, setChatRoom } = useChatContext()
  const [chatRooms, setChatRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'WAITING_AGENT' | 'LIVE' | 'CLOSED' | 'BOT' | undefined>(undefined)

  useEffect(() => {
    if (domains && domains.length > 0) {
      const firstDomainId = domains[0]?.id
      if (!firstDomainId) return
      setValue('domain', firstDomainId)
      setLoading(true)
      onGetDomainChatRooms(firstDomainId, filter)
        .then((rooms) => { if (rooms) setChatRooms(rooms.customer) })
        .finally(() => setLoading(false))
    }
  }, [domains, filter])

  useEffect(() => {
    const search = watch(async (value) => {
      if (!value.domain) return
      setLoading(true)
      try {
        const rooms = await onGetDomainChatRooms(value.domain, filter)
        if (rooms) setChatRooms(rooms.customer)
      } finally {
        setLoading(false)
      }
    })
    return () => search.unsubscribe()
  }, [watch, filter])

  const onSetFilter = (f: 'WAITING_AGENT' | 'LIVE' | 'CLOSED' | 'BOT' | undefined) => {
    setFilter(f)
    if (domains && domains.length > 0) {
      setLoading(true)
      onGetDomainChatRooms(domains[0]!.id, f)
        .then((rooms) => { if (rooms) setChatRooms(rooms.customer) })
        .finally(() => setLoading(false))
    }
  }

  const onGetActiveChatMessages = async (id: string) => {
    try {
      loadMessages(true)
      const messages = await onGetChatMessages(id)
      if (messages?.ok && Array.isArray(messages.data) && messages.data[0]?.message) {
        setChatRoom(id)
        setChats(((messages.data as any[])[0]?.message ?? []) as ChatMsg[])
      }
    } finally {
      loadMessages(false)
    }
  }

  const onCloseChat = async (id: string) => {
    const res = await onCloseConversation(id)
    if (res?.ok) {
      setFilter(undefined)
      setChatRooms(prev => prev.map((c: any) => c.chatRoom.map((r: any) => r.id === id ? { ...r, status: 'CLOSED' } : r)).flat())
    }
  }

  const onReturnChatToBot = async (id: string) => {
    const res = await onReturnToBot(id)
    if (res?.ok) {
      setFilter(undefined)
      setChatRooms((prev: any[]) => prev.map((c: any) => c.chatRoom.map((r: any) => r.id === id ? { ...r, status: 'BOT', assignedToUserId: null } : r)).flat())
    }
  }

  return { register, chatRooms, loading, onGetActiveChatMessages, onCloseChat, onReturnChatToBot, onSetFilter, filter }
}

export const useChatTime = (createdAt: Date, roomId: string) => {
  const { chatRoom } = useChatContext()
  const [messageSentAt, setMessageSentAt] = useState<string>()
  const [urgent, setUrgent] = useState<boolean>(false)

  useEffect(() => {
    const dt = new Date(createdAt)
    const current = new Date()
    const difference = current.getDate() - dt.getDate()
    if (difference <= 0) {
      setMessageSentAt(`${dt.getHours()}:${dt.getMinutes()}${dt.getHours() > 12 ? 'PM' : 'AM'}`)
      if (current.getHours() - dt.getHours() < 2) setUrgent(true)
    } else {
      setMessageSentAt(`${dt.getDate()} ${getMonthName(dt.getMonth() + 1)}`)
    }
  }, [createdAt])

  useEffect(() => {
    if (chatRoom == roomId && urgent) {
      onViewUnReadMessages(roomId)
      setUrgent(false)
    }
  }, [chatRoom, roomId, urgent])

  return { messageSentAt, urgent, onSeenChat: async () => {} }
}

export const useChatWindow = () => {
  const { chats, loading, setChats, chatRoom } = useChatContext()
  const messageWindowRef = useRef<HTMLDivElement | null>(null)
  const { register, handleSubmit, reset } = useForm({
    resolver: zodResolver(ChatBotMessageSchema) as any,
    mode: 'onChange',
  })
  const [liveMode, setLiveMode] = useState(false)
  const [liveLoading, setLiveLoading] = useState(false)

  useEffect(() => {
    messageWindowRef.current?.scroll({ top: messageWindowRef.current.scrollHeight, left: 0, behavior: 'smooth' })
  }, [chats])

  useEffect(() => {
    if (chatRoom) {
      onGetConversationMode(chatRoom).then((mode) => { if (mode) setLiveMode(!!mode.live) })
    }
  }, [chatRoom])

  const onHandleSentMessage = handleSubmit(async (values) => {
    try {
      reset()
      if (!chatRoom) return
      const message = await onOwnerSendMessage(chatRoom, values.content, 'assistant')
      const msgData = (message as any)?.data
      if (message?.ok && msgData?.message?.[0]) {
        const newMsg = msgData.message[0] as ChatMsg
        setChats((prev) => [...prev, newMsg] as any)
        await onRealTimeChat(chatRoom, newMsg.message, newMsg.id, 'assistant')
      }
    } catch (error) {
      console.log(error)
    }
  })

  const onToggleLiveMode = async () => {
    if (!chatRoom) return
    setLiveLoading(true)
    try {
      const targetStatus = liveMode ? 'BOT' : 'LIVE'
      const result = await onToggleRealtime(chatRoom, targetStatus)
      if (result?.ok) setLiveMode(targetStatus === 'LIVE')
    } finally {
      setLiveLoading(false)
    }
  }

  return { messageWindowRef, register, onHandleSentMessage, chats, loading, chatRoom, liveMode, liveLoading, onToggleLiveMode }
}
