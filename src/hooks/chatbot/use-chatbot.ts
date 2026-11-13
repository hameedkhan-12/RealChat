'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ChatMessageType } from '@/schemas/conversation.schema'

type Brand = {
  botName?: string | null
  welcomeMessage?: string | null
  avatarUrl?: string | null
  primaryColor?: string | null
  textColor?: string | null
  position?: string | null
  launcherLabel?: string | null
  fontFamily?: string | null
  borderRadius?: string | null
  privacyPolicyUrl?: string | null
  consentText?: string | null
  offlineMessage?: string | null
  showPoweredBy?: boolean | null
}

type WidgetConfig = {
  domainName: string
  timezone: string
  defaultLocale: string
  brand: Brand
  features: { booking: boolean; handoff: boolean }
}

type UseChatBotReturn = {
  botOpened: boolean
  onOpenChatBot: () => void
  handleSendMessage: (values: { content?: string }) => void
  onSelectOption: (option: string) => void
  onBookSlot: (dateStr: string, slotTime: string) => void
  onRestartChat: () => void
  onChats: ChatMessageType[]
  register: any
  onAiTyping: boolean
  messageWindowRef: React.RefObject<HTMLDivElement | null>
  currentBot: any
  loading: boolean
  config: WidgetConfig | undefined
  sessionToken: string | undefined
  chatRoomId: string | undefined
  consentGiven: boolean
  setConsentGiven: (v: boolean) => void
  requestHandoff: () => void
  status: 'BOT' | 'WAITING_AGENT' | 'LIVE' | 'CLOSED'
  acceptConsent: () => Promise<void>
  sendMessage: (text: string, answer?: string | null) => Promise<void>
  errors: any
  getValues: any
}

export const useChatBot = (publicKey?: string): UseChatBotReturn => {
  const [currentBot, setCurrentBot] = useState<any>()
  const [config, setConfig] = useState<WidgetConfig | undefined>()
  const [sessionToken, setSessionToken] = useState<string | undefined>()
  const [chatRoomId, setChatRoomId] = useState<string | undefined>()
  const messageWindowRef = useRef<HTMLDivElement | null>(null)
  const [botOpened, setBotOpened] = useState(false)
  const [loading, setLoading] = useState(true)
  const [onChats, setOnChats] = useState<ChatMessageType[]>([])
  const [onAiTyping, setOnAiTyping] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const [status, setStatus] = useState<'BOT' | 'WAITING_AGENT' | 'LIVE' | 'CLOSED'>('BOT')

  const onScrollToBottom = useCallback(() => {
    messageWindowRef.current?.scroll({ top: messageWindowRef.current.scrollHeight, left: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => { onScrollToBottom() }, [onChats])

  // Resize: tell the host page our desired state
  const notifyResize = useCallback(() => {
    if (typeof window === 'undefined' || !window.parent || window.parent === window) return
    const position = (config?.brand.position ?? 'BOTTOM_RIGHT') === 'BOTTOM_LEFT' ? 'BOTTOM_LEFT' : 'BOTTOM_RIGHT'
    window.parent.postMessage(
      { type: 'widget:state', open: botOpened, position, hasLabel: true },
      '*'
    )
  }, [botOpened, config])

  useEffect(() => { notifyResize() }, [notifyResize])

  const buildInitialMessages = (bot: any): ChatMessageType[] => {
    const welcome = bot?.welcomeMessage || config?.brand.welcomeMessage || 'Hi! How can we help you today?'
    return [{ role: 'assistant', content: welcome }]
  }

  const initSession = useCallback(async (pk: string) => {
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
        const cfgRes = await fetch('/api/widget/config', {
          headers: { Authorization: `Bearer ${data.sessionToken}` },
        })
        if (cfgRes.ok) {
          const cfg = await cfgRes.json()
          if (cfg.ok) {
            setConfig(cfg.config as WidgetConfig)
            setCurrentBot(cfg.config.chatBot)
            setOnChats(buildInitialMessages(cfg.config.chatBot))
            setStatus('BOT')
          }
        }
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (publicKey) initSession(publicKey)
  }, [publicKey, initSession])

  // Listen for postMessage from parent (embed.js) passing the public key
  useEffect(() => {
    const handleParentMessage = (e: MessageEvent) => {
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
  }, [sessionToken, publicKey, initSession])

  const sendMessage = useCallback(async (text: string, answer?: string | null) => {
    if (!sessionToken) return
    const userMsg: ChatMessageType = { role: 'user', content: text }
    const updatedChats = [...onChats, userMsg]
    setOnChats(updatedChats)
    setOnAiTyping(true)
    try {
      const res = await fetch('/api/widget/message', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'answer', answer }),
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
        setStatus('CLOSED')
        const actionsMsg: ChatMessageType = {
          role: 'assistant',
          content: 'Thank you! How would you like to proceed?',
          widget: 'chat-ended',
          widgetData: { actions: data.actions ?? [] },
        }
        setOnChats((prev) => [...prev, actionsMsg])
      }
    } catch {
      setOnAiTyping(false)
    }
  }, [sessionToken, onChats])

  const handleSendMessage = async (values: { content?: string }) => {
    // form reset handled by caller
    if (values.content) await sendMessage(values.content)
  }

  const onSelectOption = async (option: string) => { await sendMessage(option) }
  const onBookSlot = async (_dateStr: string, _slotTime: string) => { /* booking handled by manage page */ }
  const onRestartChat = () => { if (currentBot) setOnChats(buildInitialMessages(currentBot)) }

  const acceptConsent = async () => {
    if (!sessionToken) return
    try {
      const res = await fetch('/api/widget/message', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'consent' }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (!data.ok) return
      setConsentGiven(true)
      setStatus('BOT')
      if (data.kind === 'step' && data.step) {
        setOnChats([{ role: 'assistant', content: data.step.prompt }])
      } else {
        setStatus('CLOSED')
      }
    } catch {}
  }

  const requestHandoff = async () => {
    if (!sessionToken) return
    try {
      const res = await fetch('/api/widget/handoff', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'visitor requested' }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.ok) {
        setStatus('WAITING_AGENT')
        setOnChats((prev) => [...prev, { role: 'assistant', content: 'A person will be with you shortly.' }])
      }
    } catch {}
  }

  return {
    botOpened, onOpenChatBot: () => setBotOpened((p) => !p), handleSendMessage,
    onSelectOption, onBookSlot, onRestartChat, onChats, register: null as any, onAiTyping,
    messageWindowRef, currentBot, loading, config, sessionToken, chatRoomId,
    consentGiven, setConsentGiven, requestHandoff, status,
    acceptConsent, sendMessage, getValues: null as any, errors: null as any,
  }
}
