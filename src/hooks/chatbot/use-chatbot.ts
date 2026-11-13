'use client'

import { ChatBotMessageSchema, ChatMessageType } from '@/schemas/conversation.schema'
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
    bookingEnabled?: boolean
    handoffEnabled?: boolean
  } | null
  helpdesk: { id: string; question: string; answer: string; domainId?: string | null }[]
}

type WidgetConfig = {
  chatBot: CurrentBot['chatBot']
  domainName: string
  timezone: string
  defaultLocale: string
}

export const useChatBot = (publicKey?: string) => {
  const { register, handleSubmit, reset, formState: { errors }, getValues } = useForm({
    resolver: zodResolver(ChatBotMessageSchema) as any,
  })

  const [currentBot, setCurrentBot] = useState<CurrentBot | undefined>()
  const [config, setConfig] = useState<WidgetConfig | undefined>()
  const [sessionToken, setSessionToken] = useState<string | undefined>()
  const [chatRoomId, setChatRoomId] = useState<string | undefined>()
  const messageWindowRef = useRef<HTMLDivElement | null>(null)
  const [botOpened, setBotOpened] = useState(false)
  const onOpenChatBot = () => setBotOpened((prev) => !prev)
  const [loading, setLoading] = useState(true)
  const [onChats, setOnChats] = useState<ChatMessageType[]>([])
  const [onAiTyping, setOnAiTyping] = useState(false)
  const [onRealTime, setOnRealTime] = useState<{ chatroom: string; mode: boolean } | undefined>()

  const onScrollToBottom = () => {
    messageWindowRef.current?.scroll({ top: messageWindowRef.current.scrollHeight, left: 0, behavior: 'smooth' })
  }

  useEffect(() => { onScrollToBottom() }, [onChats])

  const buildInitialMessages = (bot: CurrentBot | undefined): ChatMessageType[] => {
    const welcome = bot?.chatBot?.welcomeMessage || 'Hi! How can we help you today?'
    return [{ role: 'assistant', content: welcome }]
  }

  const initSession = async (pk: string) => {
    try {
      const res = await fetch('/api/widget/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: pk }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.ok) {
        setSessionToken(data.sessionToken)
        setChatRoomId(data.chatRoomId)
        // fetch config
        const cfgRes = await fetch('/api/widget/config', {
          headers: { Authorization: `Bearer ${data.sessionToken}` },
        })
        if (cfgRes.ok) {
          const cfg = await cfgRes.json()
          if (cfg.ok) {
            setConfig(cfg.config as WidgetConfig)
            setCurrentBot(cfg.config.chatBot as CurrentBot)
            setOnChats(buildInitialMessages(cfg.config.chatBot as CurrentBot))
          }
        }
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (publicKey) initSession(publicKey)
  }, [publicKey])

  // Listen for postMessage from parent (embed.js) passing the public key
  useEffect(() => {
    const handleParentMessage = (e: MessageEvent) => {
      // verify origin in production
      let botid = e.data
      if (typeof botid === 'object' && botid !== null) {
        botid = botid.id || botid.botId || botid.domainId || botid.key || botid.publicKey
      }
      if (typeof botid === 'string' && botid.trim().length > 0 && !sessionToken) {
        initSession(botid.trim())
      }
    }
    window.addEventListener('message', handleParentMessage)
    return () => window.removeEventListener('message', handleParentMessage)
  }, [sessionToken, publicKey])

  const sendMessage = async (text: string, stepKey?: string, answer?: string) => {
    if (!sessionToken) return
    const userMsg: ChatMessageType = { role: 'user', content: text }
    const updatedChats = [...onChats, userMsg]
    setOnChats(updatedChats)
    setOnAiTyping(true)
    try {
      const res = await fetch('/api/widget/message', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: text, stepKey, answer }),
      })
      setOnAiTyping(false)
      if (!res.ok) return
      const data = await res.json()
      if (!data.ok) return

      if (data.kind === 'step' && data.step) {
        const botMsg: ChatMessageType = { role: 'assistant', content: data.step.prompt }
        setOnChats((prev) => [...prev, botMsg])
      }
      if (data.kind === 'complete') {
        const actionsMsg: ChatMessageType = {
          role: 'assistant',
          content: 'Thank you! How would you like to proceed?',
          widget: 'chat-ended',
          widgetData: data.actions ? { actions: data.actions } : {},
        }
        setOnChats((prev) => [...prev, actionsMsg])
      }
    } catch {
      setOnAiTyping(false)
    }
  }

  const handleSendMessage = async (values: { content?: string }) => {
    reset()
    if (values.content) await sendMessage(values.content)
  }

  const onSelectOption = async (option: string) => { await sendMessage(option) }
  const onBookSlot = async (_dateStr: string, _slotTime: string) => { /* Phase 5 */ }
  const onRestartChat = () => { if (currentBot) setOnChats(buildInitialMessages(currentBot)) }

  return {
    botOpened, onOpenChatBot, handleSendMessage, onSelectOption, onBookSlot, onRestartChat,
    onChats, register, onAiTyping, messageWindowRef, currentBot, loading, setOnChats, onRealTime, errors,
    config, sessionToken, chatRoomId, sendMessage, getValues,
  }
}

export const useRealTime = (
  chatRoom: string,
  setChats: React.Dispatch<React.SetStateAction<ChatMessageType[]>>
) => {
  useEffect(() => { void chatRoom; void setChats }, [chatRoom, setChats])
}
