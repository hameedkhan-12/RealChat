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
  turnstileSiteKey?: string | null
  flow: any[]
  locale: string
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
  sendQuestion: (content: string) => Promise<void>
  errors: any
  getValues: any
  turnstileSiteKey?: string | null
  flow: any[]
  locale: string
}

export const useChatBot = (publicKey?: string): UseChatBotReturn => {
  const [currentBot, setCurrentBot] = useState<any>()
  const [config, setConfig] = useState<WidgetConfig | undefined>()
  const [sessionToken, setSessionToken] = useState<string | undefined>(() => {
    // Restore session from localStorage on mount
    if (typeof window !== 'undefined') {
      return localStorage.getItem('realchat_session_token') || undefined
    }
    return undefined
  })
  const [chatRoomId, setChatRoomId] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('realchat_chat_room_id') || undefined
    }
    return undefined
  })
  const [consentGiven, setConsentGiven] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('realchat_consent_given') === 'true'
    }
    return false
  })
  const messageWindowRef = useRef<HTMLDivElement | null>(null)
  const [botOpened, setBotOpened] = useState(false)
  const [loading, setLoading] = useState(true)
  const [onChats, setOnChats] = useState<ChatMessageType[]>([])
  const [onAiTyping, setOnAiTyping] = useState(false)
  const [status, setStatus] = useState<'BOT' | 'WAITING_AGENT' | 'LIVE' | 'CLOSED'>('BOT')
  const [error, setError] = useState<string | null>(null)

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

  // Restore messages after session restoration
  const loadMessages = useCallback(async () => {
    if (!chatRoomId) return
    try {
      const res = await fetch('/api/widget/messages', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.ok && data.messages) {
          setOnChats(
            data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            }))
          )
        }
      }
    } catch {
      // messages load failure is non-fatal
    }
  }, [chatRoomId, sessionToken])

  const initSession = useCallback(async (pk: string, turnstileToken?: string) => {
    try {
      const res = await fetch('/api/widget/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: pk, turnstileToken }),
      })
      if (!res.ok) {
        setError('Unable to start session')
        setLoading(false)
        return
      }
      const data = await res.json()
      if (data.ok) {
        setSessionToken(data.sessionToken)
        setChatRoomId(data.chatRoomId)
        // Persist for refresh restoration
        if (typeof window !== 'undefined') {
          localStorage.setItem('realchat_session_token', data.sessionToken)
          localStorage.setItem('realchat_chat_room_id', data.chatRoomId)
        }
        const cfgRes = await fetch('/api/widget/config', {
          headers: { Authorization: `Bearer ${data.sessionToken}` },
        })
        if (cfgRes.ok) {
          const cfg = await cfgRes.json()
          if (cfg.ok) {
            setConfig(cfg as WidgetConfig)
            setCurrentBot(cfg.bot)
            setStatus('BOT')
            setOnChats(buildInitialMessages(cfg.bot))
            // Load existing messages for this session
            await loadMessages()
          }
        }
      }
      setLoading(false)
    } catch {
      setError('Unable to start session')
      setLoading(false)
    }
  }, [loadMessages])

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
    setError(null)
    try {
      const res = await fetch('/api/widget/message', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'FLOW_ANSWER', stepKey: '', answer }),
      })
      setOnAiTyping(false)
      if (!res.ok) {
        // Roll back the optimistic user message on failure
        setOnChats((prev) => prev.filter((m) => m !== userMsg))
        setError('Failed to send message')
        return
      }
      const data = await res.json()
      if (!data.ok) {
        setOnChats((prev) => prev.filter((m) => m !== userMsg))
        setError('Failed to send message')
        return
      }

      if (data.kind === 'step' && data.step) {
        const botMsg: ChatMessageType = { role: 'assistant', content: data.step.prompt }
        setOnChats((prev) => [...prev, botMsg])
      }
      if (data.flowCompleted) {
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
      setOnChats((prev) => prev.filter((m) => m !== userMsg))
      setOnAiTyping(false)
      setError('Failed to send message')
    }
  }, [sessionToken, onChats])

  const handleSendMessage = async (values: { content?: string }) => {
    // form reset handled by caller
    if (values.content) await sendMessage(values.content)
  }

  const onSelectOption = async (option: string) => { await sendMessage(option) }
  const onBookSlot = async (_dateStr: string, _slotTime: string) => { /* booking handled by manage page */ }
  const onRestartChat = () => { if (currentBot) setOnChats(buildInitialMessages(currentBot)) }

  const sendQuestion = useCallback(async (content: string) => {
    if (!sessionToken) return
    const userMsg: ChatMessageType = { role: 'user', content }
    const updatedChats = [...onChats, userMsg]
    setOnChats(updatedChats)
    setOnAiTyping(true)
    setError(null)
    try {
      const res = await fetch('/api/widget/message', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'QUESTION', content }),
      })
      setOnAiTyping(false)
      if (!res.ok) {
        setOnChats((prev) => prev.filter((m) => m !== userMsg))
        setError('Failed to send question')
        return
      }
      const data = await res.json()
      if (!data.ok) {
        setOnChats((prev) => prev.filter((m) => m !== userMsg))
        setError('Failed to send question')
        return
      }
      // Append returned messages (visitor question + AI answer)
      data.messages?.forEach((m: any) => {
        setOnChats((prev) => [...prev, { id: m.id, role: m.role, content: m.content, createdAt: m.createdAt }])
      })
      if (data.flowCompleted) {
        setStatus('CLOSED')
      }
    } catch {
      setOnChats((prev) => prev.filter((m) => m !== userMsg))
      setOnAiTyping(false)
      setError('Failed to send question')
    }
  }, [sessionToken, onChats])

  const acceptConsent = async () => {
    if (!sessionToken) return
    try {
      const res = await fetch('/api/widget/message', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'CONSENT', accepted: true }),
      })
      if (!res.ok) {
        setError('Failed to accept consent')
        return
      }
      const data = await res.json()
      if (!data.ok) {
        setError('Failed to accept consent')
        return
      }
      setConsentGiven(true)
      if (typeof window !== 'undefined') {
        localStorage.setItem('realchat_consent_given', 'true')
      }
      setStatus('BOT')
      if (data.kind === 'step' && data.step) {
        setOnChats([{ role: 'assistant', content: data.step.prompt }])
      } else {
        setOnChats([])
      }
    } catch {
      setError('Failed to accept consent')
    }
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

  const turnstileSiteKey = config?.turnstileSiteKey ?? undefined
  const flow = config?.flow ?? []
  const locale = config?.locale ?? 'en'

  return {
    botOpened, onOpenChatBot: () => setBotOpened((p) => !p), handleSendMessage,
    onSelectOption, onBookSlot, onRestartChat, onChats, register: null as any, onAiTyping,
    messageWindowRef, currentBot, loading, config, sessionToken, chatRoomId,
    consentGiven, setConsentGiven, requestHandoff, status,
    acceptConsent, sendMessage, sendQuestion, getValues: null as any,
    errors: error, turnstileSiteKey, flow, locale,
  }
}

export const useRealTime = (_chatRoom: string, _setChats: React.Dispatch<React.SetStateAction<any[]>>) => {
  // no-op stub for backward compatibility with dead real-time.tsx
}
