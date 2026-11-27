'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ChatMessageType } from '@/schemas/conversation.schema'
import { WidgetConfigSchema } from '@/lib/validation'
import type { WidgetConfigResponse } from '@/lib/validation'
import Pusher from 'pusher-js'
import { CHANNEL, type MessageCreatedEvent } from '@/lib/conversation-events'

type Brand = WidgetConfigResponse['brand']
type WidgetConfig = WidgetConfigResponse

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
  initSession: (pk: string, turnstileToken?: string) => Promise<void>
}

export const useChatBot = (publicKey?: string): UseChatBotReturn => {
  const [currentBot, setCurrentBot] = useState<any>()
  const [config, setConfig] = useState<WidgetConfig | undefined>()
  const [sessionToken, setSessionToken] = useState<string | undefined>(undefined)
  const [chatRoomId, setChatRoomId] = useState<string | undefined>(undefined)
  const [consentGiven, setConsentGiven] = useState<boolean>(false)
  const messageWindowRef = useRef<HTMLDivElement | null>(null)
  const [botOpened, setBotOpened] = useState(false)
  const [loading, setLoading] = useState(true)
  const [onChats, setOnChats] = useState<ChatMessageType[]>([])
  const [onAiTyping, setOnAiTyping] = useState(false)
  const [status, setStatus] = useState<'BOT' | 'WAITING_AGENT' | 'LIVE' | 'CLOSED'>('BOT')
  const [error, setError] = useState<string | null>(null)
  const [currentStepKey, setCurrentStepKey] = useState<string | null>(null)

  const [sessionInitialized, setSessionInitialized] = useState(false)
  const initLockRef = useRef<boolean>(false)

  // Scoped storage keys per public key
  const storageKey = useCallback((suffix: string) => (publicKey ? `realchat:${publicKey}:${suffix}` : suffix), [publicKey])

  /* ----------------------------------------------------------------
   * Bootstrap order: config -> Turnstile -> session -> messages
   * ---------------------------------------------------------------- */

  // Step 1: Fetch widget config first (key-validated endpoint)
  useEffect(() => {
    let cancelled = false
    const loadConfig = async () => {
      if (!publicKey) return
      try {
        const res = await fetch(`/api/widget/config?key=${encodeURIComponent(publicKey)}`)
        if (!res.ok) {
          setLoading(false)
          return
        }
        const data = await res.json()
        const parsed = WidgetConfigSchema.safeParse(data)
        if (!parsed.success) {
          setLoading(false)
          return
        }
        setConfig(parsed.data)
        setCurrentBot(parsed.data.brand)
        setStatus('BOT')
      } catch {
        // config load failure is non-fatal
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadConfig()
    return () => { cancelled = true }
  }, [publicKey])

  // Step 2 + 3: After config loads, restore or create a session.
  // Restored sessions are validated server-side; duplicates are prevented.
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      if (!publicKey || !config || sessionInitialized || initLockRef.current) return
      initLockRef.current = true

      const tokenKey = storageKey('session_token')
      const roomKey = storageKey('chat_room_id')

      // Try restoring an existing session from scoped localStorage.
      let restoredToken: string | undefined
      let restoredRoomId: string | undefined
      if (typeof window !== 'undefined') {
        restoredToken = localStorage.getItem(tokenKey) || undefined
        restoredRoomId = localStorage.getItem(roomKey) || undefined
      }

      if (restoredToken && restoredRoomId) {
        // Validate restored session server-side before trusting it.
        try {
          const res = await fetch('/api/widget/messages', {
            headers: { Authorization: `Bearer ${restoredToken}` },
          })
          if (res.ok) {
            setSessionToken(restoredToken)
            setChatRoomId(restoredRoomId)
            setSessionInitialized(true)
            initLockRef.current = false
            setLoading(false)
            return
          }
        } catch {
          // fall through to create new session
        }
        // Restored session invalid -> clear stale keys and create new
        if (typeof window !== 'undefined') {
          localStorage.removeItem(tokenKey)
          localStorage.removeItem(roomKey)
        }
      }

      // Create a new session.
      try {
        const res = await fetch('/api/widget/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: publicKey }),
        })
        if (!res.ok) {
          setError('Unable to start session')
          setLoading(false)
          initLockRef.current = false
          return
        }
        const data = await res.json()
        if (data.ok && data.sessionToken && data.chatRoomId) {
          setSessionToken(data.sessionToken)
          setChatRoomId(data.chatRoomId)
          setSessionInitialized(true)
          if (typeof window !== 'undefined') {
            localStorage.setItem(tokenKey, data.sessionToken)
            localStorage.setItem(roomKey, data.chatRoomId)
          }
          setLoading(false)
          initLockRef.current = false
          return
        }
      } catch {
        // fall through
      }
      setError('Unable to start session')
      setLoading(false)
      initLockRef.current = false
    }
    init()
    return () => { cancelled = true }
  }, [config, publicKey, storageKey, sessionInitialized])

  // Step 4: After session established, load persisted messages.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!chatRoomId || !sessionToken) return
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
    }
    load()
    return () => { cancelled = true }
  }, [chatRoomId, sessionToken])

  // Step 5: Subscribe to Pusher room channel for real-time visitor updates.
  // Persist first, then publish: on message.created, clients recover the full
  // persisted message via GET /api/widget/messages.
  useEffect(() => {
    let cancelled = false
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

    if (!key || !cluster || !chatRoomId || !sessionToken) {
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

    const pendingMessageIds = new Set<string>()

    channel.bind('message.created', async (data: MessageCreatedEvent) => {
      if (data.roomId !== chatRoomId) return
      // Deduplicate by messageId
      if (pendingMessageIds.has(data.messageId)) return
      pendingMessageIds.add(data.messageId)

      try {
        const res = await fetch('/api/widget/messages', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
        if (!res.ok) return
        const data2 = await res.json()
        const items = data2?.items ?? data2?.messages ?? []
        const newItem = items.find((m: any) => m.id === data.messageId)
        if (!newItem) return

        setOnChats((prev) => {
          if (prev.some((m) => m.id === newItem.id)) return prev
          return [
            ...prev,
            {
              id: newItem.id,
              role: newItem.senderType === 'VISITOR' ? 'user' : 'assistant',
              content: newItem.message,
              createdAt: newItem.createdAt,
            },
          ]
        })
      } catch {
        // Non-fatal; message is persisted in the DB
      }
    })

    pusher.connection.bind('connected', () => {})
    pusher.connection.bind('disconnected', () => {})

    return () => {
      channel.unbind()
      pusher.disconnect()
    }
  }, [chatRoomId, sessionToken])
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

  // Client-triggered session (e.g. postMessage from parent with a Turnstile token)
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
      if (data.ok && data.sessionToken && data.chatRoomId) {
        setSessionToken(data.sessionToken)
        setChatRoomId(data.chatRoomId)
        setSessionInitialized(true)
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey('session_token'), data.sessionToken)
          localStorage.setItem(storageKey('chat_room_id'), data.chatRoomId)
        }
        setLoading(false)
      }
    } catch {
      setError('Unable to start session')
      setLoading(false)
    }
  }, [storageKey])

  useEffect(() => {
    // Don't auto-init if Turnstile is enabled — the component will call
    // initSession(publicKey, turnstileToken) after obtaining a token.
    if (
      publicKey &&
      !sessionInitialized &&
      !sessionToken &&
      !config?.turnstile.enabled
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      initSession(publicKey)
    }
  }, [publicKey, sessionInitialized, sessionToken, initSession, config])

  // Listen for postMessage from parent (embed.js) passing the public key
  useEffect(() => {
    const handleParentMessage = (e: MessageEvent) => {
      let botid = e.data
      if (typeof botid === 'object' && botid !== null) {
        botid = botid.id || botid.botId || botid.domainId || botid.key || botid.publicKey
      }
      if (typeof botid === 'string' && botid.trim().length > 0 && !sessionToken && !sessionInitialized) {
        initSession(botid.trim())
      }
    }
    window.addEventListener('message', handleParentMessage)
    return () => window.removeEventListener('message', handleParentMessage)
  }, [sessionToken, sessionInitialized, initSession, publicKey])

  const sendMessage = useCallback(async (text: string, answer?: string | null) => {
    if (!sessionToken) return
    const stepKey = currentStepKey ?? ''
    const answerValue = answer ?? text
    const idempotencyKey = crypto.randomUUID()

    const userMsg: ChatMessageType = { role: 'user', content: text }
    const updatedChats = [...onChats, userMsg]
    setOnChats(updatedChats)
    setOnAiTyping(true)
    setError(null)
    try {
      const res = await fetch('/api/widget/message', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'FLOW_ANSWER',
          stepKey,
          answer: answerValue,
          idempotencyKey,
        }),
      })
      setOnAiTyping(false)
      if (!res.ok) {
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

      if (data.currentStep) {
        setCurrentStepKey(data.currentStep.key)
        const botMsg: ChatMessageType = { role: 'assistant', content: data.currentStep.question }
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
  }, [sessionToken, onChats, currentStepKey])

  const handleSendMessage = async (values: { content?: string }) => {
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
      // UI state set ONLY after server confirms consent persistence
      setConsentGiven(true)
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey('consent_given'), 'true')
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

  const turnstileSiteKey = config?.turnstile.siteKey ?? undefined
  const flow = config?.flow.steps ?? []
  const locale = config?.domain.defaultLocale ?? 'en'

  return {
    botOpened, onOpenChatBot: () => setBotOpened((p) => !p), handleSendMessage,
    onSelectOption, onBookSlot, onRestartChat, onChats, register: null as any, onAiTyping,
    messageWindowRef, currentBot, loading, config, sessionToken, chatRoomId,
    consentGiven, setConsentGiven, requestHandoff, status,
    acceptConsent, sendMessage, sendQuestion, getValues: null as any,
    errors: error, turnstileSiteKey, flow, locale, initSession,
  }
}

export const useRealTime = (_chatRoom: string, _setChats: React.Dispatch<React.SetStateAction<any[]>>) => {
  // no-op stub for backward compatibility with dead real-time.tsx
}
