import {
  onGetChatMessages,
  onGetConversationMode,
  onGetDomainChatRooms,
  onOwnerSendMessage,
  onRealTimeChat,
  onToggleRealtime,
  onViewUnReadMessages,
} from '@/actions/conversation'
import { useChatContext } from '@/context/user-chat-context'
import { getMonthName, pusherClient } from '@/lib/utils'
import {
  ChatBotMessageSchema,
  ConversationSearchSchema,
} from '@/schemas/conversation.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

export const useConversation = (
  domains?: { name: string; id: string; icon: string }[]
) => {
  const { register, watch, setValue } = useForm({
    resolver: zodResolver(ConversationSearchSchema),
    mode: 'onChange',
  })
  const { setLoading: loadMessages, setChats, setChatRoom } = useChatContext()
  const [chatRooms, setChatRooms] = useState<
    {
      chatRoom: {
        id: string
        createdAt: Date
        message: {
          message: string
          createdAt: Date
          seen: boolean
        }[]
      }[]
      email: string | null
    }[]
  >([])
  const [loading, setLoading] = useState<boolean>(false)

  // Auto-load the first domain's chat rooms on mount
  useEffect(() => {
    if (domains && domains.length > 0) {
      const firstDomainId = domains[0]?.id
      if (!firstDomainId) return
      setValue('domain', firstDomainId)
      setLoading(true)
      onGetDomainChatRooms(firstDomainId)
        .then((rooms) => {
          if (rooms) {
            setLoading(false)
            setChatRooms(rooms.customer)
          }
        })
        .catch((err) => {
          console.log(err)
          setLoading(false)
        })
    }
  }, [])

  useEffect(() => {
    const search = watch(async (value) => {
      if (!value.domain) return
      setLoading(true)
      try {
        const rooms = await onGetDomainChatRooms(value.domain)
        if (rooms) {
          setLoading(false)
          setChatRooms(rooms.customer)
        }
      } catch (error) {
        console.log(error)
        setLoading(false)
      }
    })
    return () => search.unsubscribe()
  }, [watch])

  const onGetActiveChatMessages = async (id: string) => {
    try {
      loadMessages(true)
      const messages = await onGetChatMessages(id)
      if (messages) {
        setChatRoom(id)
        loadMessages(false)
        setChats(messages?.[0]?.message ?? [])
      }
    } catch (error) {
      console.log(error)
    }
  }
  return {
    register,
    chatRooms,
    loading,
    onGetActiveChatMessages,
  }
}

export const useChatTime = (createdAt: Date, roomId: string) => {
  const { chatRoom } = useChatContext()
  const [messageSentAt, setMessageSentAt] = useState<string>()
  const [urgent, setUrgent] = useState<boolean>(false)

  const onSetMessageRecievedDate = () => {
    const dt = new Date(createdAt)
    const current = new Date()
    const currentDate = current.getDate()
    const hr = dt.getHours()
    const min = dt.getMinutes()
    const date = dt.getDate()
    const month = dt.getMonth()
    const difference = currentDate - date

    if (difference <= 0) {
      setMessageSentAt(`${hr}:${min}${hr > 12 ? 'PM' : 'AM'}`)
      if (current.getHours() - dt.getHours() < 2) {
        setUrgent(true)
      }
    } else {
      setMessageSentAt(`${date} ${getMonthName(month)}`)
    }
  }

  const onSeenChat = async () => {
    if (chatRoom == roomId && urgent) {
      await onViewUnReadMessages(roomId)
      setUrgent(false)
    }
  }

  useEffect(() => {
    onSeenChat()
  }, [chatRoom])

  useEffect(() => {
    onSetMessageRecievedDate()
  }, [])

  return { messageSentAt, urgent, onSeenChat }
}

export const useChatWindow = () => {
  const { chats, loading, setChats, chatRoom } = useChatContext()
  const messageWindowRef = useRef<HTMLDivElement | null>(null)
  const { register, handleSubmit, reset } = useForm({
    resolver: zodResolver(ChatBotMessageSchema),
    mode: 'onChange',
  })
  const [liveMode, setLiveMode] = useState<boolean>(false)
  const [liveLoading, setLiveLoading] = useState<boolean>(false)

  const onScrollToBottom = () => {
    messageWindowRef.current?.scroll({
      top: messageWindowRef.current.scrollHeight,
      left: 0,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    onScrollToBottom()
  }, [chats, messageWindowRef])

  // Fetch current live mode state whenever chatRoom changes
  useEffect(() => {
    if (chatRoom) {
      onGetConversationMode(chatRoom).then((mode) => {
        if (mode) setLiveMode(mode.live)
      })
    }
  }, [chatRoom])

  useEffect(() => {
    if (chatRoom) {
      pusherClient.subscribe(chatRoom)
      pusherClient.bind('realtime-mode', (data: any) => {
        setChats((prev) => {
          // Avoid duplicate messages (sender already added locally)
          if (prev.some((m) => m.id === data.chat?.id)) return prev
          return [...prev, data.chat]
        })
      })

      return () => {
        pusherClient.unbind('realtime-mode')
        pusherClient.unsubscribe(chatRoom)
      }
    }
  }, [chatRoom])

  const onHandleSentMessage = handleSubmit(async (values) => {
    try {
      reset()
      if (!liveMode) {
        onToggleRealtime(chatRoom!, true).then((res) => {
          if (res?.chatRoom) setLiveMode(true)
        })
      }
      const message = await onOwnerSendMessage(
        chatRoom!,
        values.content,
        'assistant'
      )
      if (message && message.message?.[0]) {
        const newMsg = message.message[0]
        // Update local chat history immediately so the sender sees their message
        setChats((prev) => [...prev, newMsg])
        await onRealTimeChat(
          chatRoom!,
          newMsg.message,
          newMsg.id,
          'assistant'
        )
      }
    } catch (error) {
      console.log(error)
    }
  })

  const onToggleLiveMode = async () => {
    if (!chatRoom) return
    setLiveLoading(true)
    try {
      const newMode = !liveMode
      const result = await onToggleRealtime(chatRoom, newMode)
      if (result?.chatRoom) {
        setLiveMode(result.chatRoom.live)
      }
    } catch (error) {
      console.log(error)
    } finally {
      setLiveLoading(false)
    }
  }

  return {
    messageWindowRef,
    register,
    onHandleSentMessage,
    chats,
    loading,
    chatRoom,
    liveMode,
    liveLoading,
    onToggleLiveMode,
  }
}
