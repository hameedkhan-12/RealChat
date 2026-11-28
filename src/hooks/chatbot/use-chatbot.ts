'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessageType } from '@/schemas/conversation.schema'
import { WidgetConfigSchema } from '@/lib/validation'
import type { WidgetConfigResponse } from '@/lib/validation'
import Pusher from 'pusher-js'
import { CHANNEL, type MessageCreatedEvent } from '@/lib/conversation-events'
import { widgetStorageKey } from '@/lib/widget-storage'

type Brand = WidgetConfigResponse['brand']
type WidgetConfig = WidgetConfigResponse
type ChatStatus = 'BOT' | 'WAITING_AGENT' | 'LIVE' | 'CLOSED'

type UseChatBotOptions = {
  publicKey?: string
  pageUrl?: string
  utm?: Record<string, string>
  locale?: 'en' | 'ar'
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
  consentPending: boolean
  setConsentGiven: (v: boolean) => void
  requestHandoff: () => void
  status: ChatStatus
  acceptConsent: () => Promise<void>
  sendMessage: (text: string, answer?: string | null) => Promise<void>
  sendQuestion: (content: string) => Promise<void>
  errors: any
  getValues: any
  turnstileSiteKey?: string | null
  turnstileResetSignal: number
  onTurnstileToken: (token: string) => void
  onTurnstileExpired: () => void
  onTurnstileError: () => void
  retrySession: () => void
  flow: any[]
  locale: string
}

type SessionRestorePayload = {
  ok?: boolean
  chatRoomId?: string
  consentGiven?: boolean
  status?: ChatStatus
  currentStepKey?: string | null
}

export const useChatBot = ({
  publicKey,
  pageUrl,
  utm,
  locale: requestedLocale,
}: UseChatBotOptions = {}): UseChatBotReturn => {
  const [currentBot, setCurrentBot] = useState<Brand>()
  const [config, setConfig] = useState<WidgetConfig | undefined>()
  const [sessionToken, setSessionToken] = useState<string | undefined>(undefined)
  const [chatRoomId, setChatRoomId] = useState<string | undefined>(undefined)
  const [consentGiven, setConsentGiven] = useState<boolean>(false)
  const [consentPending, setConsentPending] = useState(false)
  const messageWindowRef = useRef<HTMLDivElement | null>(null)
  const [botOpened, setBotOpened] = useState(false)
  const [loading, setLoading] = useState(Boolean(publicKey))
  const [onChats, setOnChats] = useState<ChatMessageType[]>([])
  const [onAiTyping, setOnAiTyping] = useState(false)
  const [status, setStatus] = useState<ChatStatus>('BOT')
  const [error, setError] = useState<string | null>(publicKey ? null : 'Missing widget key')
  const [currentStepKey, setCurrentStepKey] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0)

  // Guards session creation. `sessionReadyRef` is set as soon as a session is
  // restored or created so re-renders (including React StrictMode) cannot
  // start a second initialization.
  const initLockRef = useRef(false)
  const sessionReadyRef = useRef(false)

  // Stable dependency for the UTM object, which callers may recreate per render.
  const utmJson = utm && Object.keys(utm).length > 0 ? JSON.stringify(utm) : ''

  /* ----------------------------------------------------------------
   * 1. Load the shared widget configuration contract.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false

    if (!publicKey) return

    const loadConfig = async () => {
      try {
        const res = await fetch(`/api/widget/config?key=${encodeURIComponent(publicKey)}`)
        if (!res.ok) {
          if (!cancelled) {
            setError('Unable to load chat configuration')
            setLoading(false)
          }
          return
        }
        const data = await res.json()
        const parsed = WidgetConfigSchema.safeParse(data)
        if (!parsed.success) {
          if (!cancelled) {
            setError('Invalid chat configuration')
            setLoading(false)
          }
          return
        }
        if (cancelled) return
        setConfig(parsed.data)
        setCurrentBot(parsed.data.brand)
        setStatus('BOT')
        setError(null)
        // `loading` stays true until the session orchestrator finishes.
      } catch {
        if (!cancelled) {
          setError('Unable to load chat configuration')
          setLoading(false)
        }
      }
    }

    void loadConfig()
    return () => {
      cancelled = true
    }
  }, [publicKey])

  /* ----------------------------------------------------------------
   * 2. The single session initialization orchestrator.
   *
   * Order: restore a server-valid session -> wait for Turnstile (when
   * required) -> create exactly one session with attribution.
   * ---------------------------------------------------------------- */
  const initializeSession = useCallback(
    async (token: string | null) => {
      if (!publicKey || !config) return
      if (initLockRef.current || sessionReadyRef.current) return
      if (config.turnstile.enabled && !token) return

      initLockRef.current = true
      // Defer state writes out of the synchronous effect body; the lock above
      // already guarantees only one attempt can be in flight.
      await Promise.resolve()
      setLoading(true)
      setError(null)

      const tokenKey = widgetStorageKey(publicKey, 'session_token')
      const roomKey = widgetStorageKey(publicKey, 'chat_room_id')
      let restored = false

      // Restore first: a stored token is only trusted after the server
      // validates it and returns the authoritative room state.
      const storedToken =
        typeof window !== 'undefined' ? window.localStorage.getItem(tokenKey) : null
      if (storedToken) {
        try {
          const res = await fetch('/api/widget/messages', {
            headers: { Authorization: `Bearer ${storedToken}` },
          })
          if (res.ok) {
            const data = (await res.json().catch(() => null)) as SessionRestorePayload | null
            if (data?.ok && data.chatRoomId) {
              sessionReadyRef.current = true
              restored = true
              setSessionToken(storedToken)
              setChatRoomId(data.chatRoomId)
              setConsentGiven(Boolean(data.consentGiven))
              setStatus(data.status ?? 'BOT')
              setCurrentStepKey(data.currentStepKey ?? null)
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(roomKey, data.chatRoomId)
              }
            }
          }
        } catch {
          // Fall through to create a new session.
        }

        if (!restored && typeof window !== 'undefined') {
          window.localStorage.removeItem(tokenKey)
          window.localStorage.removeItem(roomKey)
        }
      }

      if (restored) {
        setLoading(false)
        initLockRef.current = false
        return
      }

      // Never create a session without a token when Turnstile is required.
      if (config.turnstile.enabled && !token) {
        setLoading(false)
        initLockRef.current = false
        return
      }

      try {
        const body: Record<string, unknown> = { key: publicKey }
        if (token) body.turnstileToken = token
        if (pageUrl) body.pageUrl = pageUrl
        if (utmJson) body.utm = JSON.parse(utmJson)
        if (requestedLocale) body.locale = requestedLocale

        const res = await fetch('/api/widget/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => null)

        if (!res.ok || !data?.ok || !data.sessionToken || !data.chatRoomId) {
          if (res.status === 403) {
            // The Turnstile token was rejected or expired. Ask the component
            // to reset the widget so a fresh token can be issued.
            setTurnstileToken(null)
            setTurnstileResetSignal((n) => n + 1)
            setError('Verification failed. Please try again.')
          } else {
            setError('Unable to start session')
          }
          return
        }

        sessionReadyRef.current = true
        setSessionToken(data.sessionToken)
        setChatRoomId(data.chatRoomId)
        setConsentGiven(false)
        setCurrentStepKey(null)
        setError(null)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(tokenKey, data.sessionToken)
          window.localStorage.setItem(roomKey, data.chatRoomId)
        }
      } catch {
        setError('Unable to start session')
      } finally {
        setLoading(false)
        initLockRef.current = false
      }
    },
    [publicKey, config, pageUrl, utmJson, requestedLocale]
  )

  // The only automatic entry point into the orchestrator. Deferring the call
  // keeps the effect free of synchronous state updates (the lock still makes
  // the attempt idempotent).
  useEffect(() => {
    if (!publicKey || !config) return
    if (sessionReadyRef.current) return
    if (config.turnstile.enabled && !turnstileToken) return
    const timer = setTimeout(() => {
      void initializeSession(turnstileToken)
    }, 0)
    return () => clearTimeout(timer)
  }, [publicKey, config, turnstileToken, initializeSession])

  const onTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token)
    setError(null)
  }, [])

  const onTurnstileExpired = useCallback(() => {
    setTurnstileToken(null)
  }, [])

  const onTurnstileError = useCallback(() => {
    setError('Verification could not be completed. Please refresh the page.')
    setLoading(false)
  }, [])

  const retrySession = useCallback(() => {
    setError(null)
    void initializeSession(turnstileToken)
  }, [initializeSession, turnstileToken])

  /* ----------------------------------------------------------------
   * 3. Load persisted messages once a session exists.
   * ---------------------------------------------------------------- */
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
          if (data.ok && data.messages && !cancelled) {
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
    void load()
    return () => {
      cancelled = true
    }
  }, [chatRoomId, sessionToken])

  /* ----------------------------------------------------------------
   * 4. Subscribe to the room channel. Pusher auth must receive the
   * visitor's bearer token or the server rejects the subscription.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

    if (!key || !cluster || !chatRoomId || !sessionToken) {
      return
    }

    const pusher = new Pusher(key, {
      cluster,
      authEndpoint: '/api/pusher/auth',
      auth: { headers: { Authorization: `Bearer ${sessionToken}` } },
      disableStats: true,
      enabledTransports: ['ws', 'wss'],
    })

    const roomCh = CHANNEL.room(chatRoomId)
    const channel = pusher.subscribe(roomCh)

    const pendingMessageIds = new Set<string>()

    channel.bind('message.created', async (data: MessageCreatedEvent) => {
      if (data.roomId !== chatRoomId) return
      if (pendingMessageIds.has(data.messageId)) return
      pendingMessageIds.add(data.messageId)

      try {
        const res = await fetch('/api/widget/messages', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
        if (!res.ok) return
        const data2 = await res.json()
        const items = data2?.messages ?? data2?.items ?? []
        const newItem = items.find((m: any) => m.id === data.messageId)
        if (!newItem) return

        setOnChats((prev) => {
          if (prev.some((m) => m.id === newItem.id)) return prev
          return [
            ...prev,
            {
              id: newItem.id,
              role: newItem.role === 'user' ? 'user' : 'assistant',
              content: newItem.content,
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
    const position =
      (config?.brand.position ?? 'BOTTOM_RIGHT') === 'BOTTOM_LEFT' ? 'BOTTOM_LEFT' : 'BOTTOM_RIGHT'
    window.parent.postMessage({ type: 'widget:state', open: botOpened, position, hasLabel: true }, '*')
  }, [botOpened, config])

  useEffect(() => {
    notifyResize()
  }, [notifyResize])

  const buildInitialMessages = (bot: Brand | undefined): ChatMessageType[] => {
    const welcome = bot?.welcomeMessage || config?.brand.welcomeMessage || 'Hi! How can we help you today?'
    return [{ role: 'assistant', content: welcome }]
  }

  const sendMessage = useCallback(
    async (text: string, answer?: string | null) => {
      if (!sessionToken) return
      const stepKey = currentStepKey ?? ''
      const answerValue = answer ?? text
      const idempotencyKey = crypto.randomUUID()

      const userMsg: ChatMessageType = { role: 'user', content: text }
      setOnChats((prev) => [...prev, userMsg])
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
    },
    [sessionToken, currentStepKey]
  )

  const handleSendMessage = async (values: { content?: string }) => {
    if (values.content) await sendMessage(values.content)
  }

  const onSelectOption = async (option: string) => {
    await sendMessage(option)
  }
  const onBookSlot = async (_dateStr: string, _slotTime: string) => {
    /* booking handled by manage page */
  }
  const onRestartChat = () => {
    if (currentBot) setOnChats(buildInitialMessages(currentBot))
  }

  const sendQuestion = useCallback(
    async (content: string) => {
      if (!sessionToken) return
      const userMsg: ChatMessageType = { role: 'user', content }
      setOnChats((prev) => [...prev, userMsg])
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
          setOnChats((prev) => [
            ...prev,
            { id: m.id, role: m.role, content: m.content, createdAt: m.createdAt },
          ])
        })
        if (data.flowCompleted) {
          setStatus('CLOSED')
        }
      } catch {
        setOnChats((prev) => prev.filter((m) => m !== userMsg))
        setOnAiTyping(false)
        setError('Failed to send question')
      }
    },
    [sessionToken]
  )

  const acceptConsent = useCallback(async () => {
    if (!sessionToken || consentPending) return
    setConsentPending(true)
    setError(null)
    try {
      const res = await fetch('/api/widget/message', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'CONSENT', accepted: true }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        // Consent is only ever recorded after the server confirms it.
        setError('Failed to accept consent')
        return
      }
      setConsentGiven(true)
      setStatus('BOT')
      if (data.currentStep?.key) setCurrentStepKey(data.currentStep.key)
      const messages = Array.isArray(data.messages)
        ? data.messages.map((m: any) => ({
            id: m.id,
            role: 'assistant' as const,
            content: m.content,
            createdAt: m.createdAt,
          }))
        : []
      setOnChats(messages)
    } catch {
      setError('Failed to accept consent')
    } finally {
      setConsentPending(false)
    }
  }, [sessionToken, consentPending])

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
        setOnChats((prev) => [
          ...prev,
          { role: 'assistant', content: 'A person will be with you shortly.' },
        ])
      }
    } catch {
      // handoff failure is non-fatal
    }
  }

  const turnstileSiteKey = config?.turnstile.siteKey ?? undefined
  const flow = config?.flow.steps ?? []
  const locale = config?.domain.defaultLocale ?? 'en'

  return {
    botOpened,
    onOpenChatBot: () => setBotOpened((p) => !p),
    handleSendMessage,
    onSelectOption,
    onBookSlot,
    onRestartChat,
    onChats,
    register: null as any,
    onAiTyping,
    messageWindowRef,
    currentBot,
    loading,
    config,
    sessionToken,
    chatRoomId,
    consentGiven,
    consentPending,
    setConsentGiven,
    requestHandoff,
    status,
    acceptConsent,
    sendMessage,
    sendQuestion,
    getValues: null as any,
    errors: error,
    turnstileSiteKey,
    turnstileResetSignal,
    onTurnstileToken,
    onTurnstileExpired,
    onTurnstileError,
    retrySession,
    flow,
    locale,
  }
}

export const useRealTime = (
  _chatRoom: string,
  _setChats: React.Dispatch<React.SetStateAction<any[]>>
) => {
  // no-op stub for backward compatibility with dead real-time.tsx
}
