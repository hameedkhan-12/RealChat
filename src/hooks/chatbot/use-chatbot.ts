'use client'

import { onAiChatBotAssistant, onGetCurrentChatBot } from '@/actions/bot'
import { ChatBotMessageProps, ChatBotMessageSchema, ChatMessageType } from '@/schemas/conversation.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

type CurrentBot = {
  id?: string
  name: string
  chatBot: {
    id: string
    avatarUrl?: string | null
    icon?: string | null
    welcomeMessage: string | null
    primaryColor?: string | null
    background?: string | null
    textColor: string | null
    helpdesk?: boolean
  } | null
  helpdesk: { id: string; question: string; answer: string; domainId?: string | null }[]
}

export const useChatBot = () => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ChatBotMessageProps>({
    resolver: zodResolver(ChatBotMessageSchema) as any,
  })

  const [currentBot, setCurrentBot] = useState<CurrentBot | undefined>()
  const messageWindowRef = useRef<HTMLDivElement | null>(null)
  const [botOpened, setBotOpened] = useState(false)
  const onOpenChatBot = () => setBotOpened((prev) => !prev)
  const [loading, setLoading] = useState(true)
  const [onChats, setOnChats] = useState<ChatMessageType[]>([])
  const [onAiTyping, setOnAiTyping] = useState(false)
  const [currentBotId, setCurrentBotId] = useState<string>()
  const [onRealTime, setOnRealTime] = useState<{ chatroom: string; mode: boolean } | undefined>()

  const onScrollToBottom = () => {
    messageWindowRef.current?.scroll({ top: messageWindowRef.current.scrollHeight, left: 0, behavior: 'smooth' })
  }

  useEffect(() => { onScrollToBottom() }, [onChats])

  const buildInitialMessages = (bot: any): ChatMessageType[] => {
    const welcome = bot?.chatBot?.welcomeMessage || 'Hi! How can we help you today?'
    return [{ role: 'assistant', content: welcome }]
  }

  const onGetDomainChatBot = async (id: string) => {
    setCurrentBotId(id)
    const chatbot = await onGetCurrentChatBot(id)
    if (chatbot) {
      setOnChats(buildInitialMessages(chatbot))
      setCurrentBot(chatbot as CurrentBot)
    }
    setLoading(false)
  }

  useEffect(() => {
    const handleParentMessage = (e: MessageEvent) => {
      let botid = e.data
      if (typeof botid === 'object' && botid !== null) {
        botid = botid.id || botid.botId || botid.domainId || botid.key
      }
      if (typeof botid === 'string' && botid.trim().length > 0) {
        onGetDomainChatBot(botid.trim())
      }
    }
    window.addEventListener('message', handleParentMessage)
    return () => window.removeEventListener('message', handleParentMessage)
  }, [])

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessageType = { role: 'user', content: text }
    const updatedChats = [...onChats, userMsg]
    setOnChats(updatedChats)
    setOnAiTyping(true)
    try {
      const response = await onAiChatBotAssistant(currentBotId || '', updatedChats, 'user', text)
      setOnAiTyping(false)
      if (response) {
        const chatRoom = (response as any).chatRoom
        if ((response as any).live || chatRoom) {
          setOnRealTime({ chatroom: chatRoom, mode: Boolean((response as any).live) })
        }
        if ((response as any).response) {
          setOnChats((prev) => [...prev, (response as any).response as ChatMessageType])
        }
      }
    } catch {
      setOnAiTyping(false)
    }
  }

  const onSelectOption = async (option: string) => { await handleSendMessage(option) }
  const onBookSlot = async (_dateStr: string, _slotTime: string) => { /* TODO(Phase 5) */ }
  const onRestartChat = () => { if (currentBot) setOnChats(buildInitialMessages(currentBot)) }

  const onStartChatting = handleSubmit(async (values) => {
    reset()
    if (values.content) await handleSendMessage(values.content)
  })

  return {
    botOpened, onOpenChatBot, onStartChatting, onSelectOption, onBookSlot, onRestartChat,
    onChats, register, onAiTyping, messageWindowRef, currentBot, loading, setOnChats, onRealTime, errors,
  }
}

export const useRealTime = (
  chatRoom: string,
  setChats: React.Dispatch<React.SetStateAction<ChatMessageType[]>>
) => {
  useEffect(() => { void chatRoom; void setChats }, [chatRoom, setChats])
}
