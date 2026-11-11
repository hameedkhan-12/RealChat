import { onAiChatBotAssistant, onGetCurrentChatBot } from '@/actions/bot'
import { onBookChatBotAppointment } from '@/actions/appointment'
import { extractEmailsFromString, postToParent, pusherClient } from '@/lib/utils'
import {
  ChatBotMessageProps,
  ChatBotMessageSchema,
  ChatMessageType,
} from '@/schemas/conversation.schema'
import { REAL_ESTATE_CONFIG } from '@/constants/real-estate-flow'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { UploadClient } from '@uploadcare/upload-client'
import { useForm } from 'react-hook-form'

const upload = new UploadClient({
  publicKey: process.env.NEXT_PUBLIC_UPLOAD_CARE_PUBLIC_KEY as string,
})

export const useChatBot = () => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChatBotMessageProps>({
    resolver: zodResolver(ChatBotMessageSchema),
  })

  const [currentBot, setCurrentBot] = useState<
    | {
        id?: string
        name: string
        chatBot: {
          id: string
          icon: string | null
          welcomeMessage: string | null
          background: string | null
          textColor: string | null
          helpdesk: boolean
        } | null
        helpdesk: {
          id: string
          question: string
          answer: string
          domainId: string | null
        }[]
      }
    | undefined
  >()

  const messageWindowRef = useRef<HTMLDivElement | null>(null)
  const [botOpened, setBotOpened] = useState<boolean>(false)
  const onOpenChatBot = () => setBotOpened((prev) => !prev)
  const [loading, setLoading] = useState<boolean>(true)
  const [onChats, setOnChats] = useState<ChatMessageType[]>([])
  const [onAiTyping, setOnAiTyping] = useState<boolean>(false)
  const [currentBotId, setCurrentBotId] = useState<string>()
  const [onRealTime, setOnRealTime] = useState<
    { chatroom: string; mode: boolean } | undefined
  >(undefined)

  const onScrollToBottom = () => {
    messageWindowRef.current?.scroll({
      top: messageWindowRef.current.scrollHeight,
      left: 0,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    onScrollToBottom()
  }, [onChats, messageWindowRef])

  let limitRequest = 0

  const buildInitialMessages = (bot: any): ChatMessageType[] => {
    const rawName = bot?.name || ''
    const isLocalOrNgrok =
      rawName.includes('ngrok') ||
      rawName.includes('localhost') ||
      rawName.includes('127.0.0.1')
    const brand = isLocalOrNgrok
      ? 'J7 Group'
      : rawName.split('.')[0].toUpperCase() || 'J7 Group'

    const welcomeMsg =
      bot?.chatBot?.welcomeMessage &&
      !bot.chatBot.welcomeMessage.includes('Hey there, have  a question')
        ? bot.chatBot.welcomeMessage
        : `Welcome to ${brand}. The Art of Elevation begins here.`

    return [
      {
        role: 'assistant',
        content: welcomeMsg,
      },
      {
        role: 'assistant',
        content: 'Please select an option below to guide us in assisting you:',
        options: REAL_ESTATE_CONFIG.intentOptions,
        step: 'intent',
      },
    ]
  }

  const onGetDomainChatBot = async (id: string) => {
    setCurrentBotId(id)
    const chatbot = await onGetCurrentChatBot(id)
    if (chatbot) {
      setOnChats(buildInitialMessages(chatbot))
      setCurrentBot(chatbot)
      setLoading(false)
    }
  }

  useEffect(() => {
    const handleParentMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return

      let botid = e.data
      if (typeof botid === 'object' && botid !== null) {
        botid = botid.id || botid.botId || botid.domainId
      }

      if (
        limitRequest < 1 &&
        typeof botid === 'string' &&
        botid.trim().length > 0
      ) {
        onGetDomainChatBot(botid.trim())
        limitRequest++
      }
    }

    window.addEventListener('message', handleParentMessage)

    // Notify parent that the chatbot listener is ready
    postToParent(
      JSON.stringify({
        type: 'CORINNA_READY',
        width: botOpened ? 420 : 75,
        height: botOpened ? 640 : 75,
      })
    )

    return () => window.removeEventListener('message', handleParentMessage)
  }, [])

  useEffect(() => {
    postToParent(
      JSON.stringify({
        width: botOpened ? 420 : 75,
        height: botOpened ? 640 : 75,
      })
    )
  }, [botOpened])

  // Helper to send text to bot action
  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessageType = { role: 'user', content: text }
    const updatedChats = [...onChats, userMsg]
    setOnChats(updatedChats)
    setOnAiTyping(true)

    try {
      const response = await onAiChatBotAssistant(
        currentBotId!,
        updatedChats,
        'user',
        text
      )

      setOnAiTyping(false)
      if (response) {
        if (response.live || response.chatRoom) {
          setOnRealTime({
            chatroom: response.chatRoom,
            mode: Boolean(response.live),
          })
        }
        if (response.response) {
          setOnChats((prev) => [...prev, response.response])
        }
      }
    } catch (err) {
      console.log('Error sending message:', err)
      setOnAiTyping(false)
    }
  }

  // Interactive quick-reply option clicked (Pills)
  const onSelectOption = async (option: string) => {
    await handleSendMessage(option)
  }

  // Book slot clicked in the interactive slot picker
  const onBookSlot = async (dateStr: string, slotTime: string) => {
    // Locate email and name from chat history
    const allEmails = onChats
      .map((c) => extractEmailsFromString(c.content || ''))
      .flat()
      .filter(Boolean)
    const customerEmail = allEmails[0] || 'client@realestate.com'

    const nameMsg = [...onChats].reverse().find((m, i, arr) => {
      const prev = arr[i + 1]
      return (
        prev?.role === 'assistant' &&
        prev?.content?.toLowerCase().includes('full name')
      )
    })
    const customerName = nameMsg?.content?.trim() || 'Valued Client'

    const rawName = currentBot?.name || ''
    const brand =
      rawName.includes('ngrok') || rawName.includes('localhost')
        ? 'J7 Group'
        : rawName.split('.')[0].toUpperCase() || 'J7 Group'

    // Show user choice immediately
    setOnChats((prev) => [
      ...prev,
      {
        role: 'user',
        content: `Booked slot: ${slotTime} on ${dateStr}`,
      },
    ])
    setOnAiTyping(true)

    try {
      await onBookChatBotAppointment({
        domainId: currentBotId || currentBot?.id || '',
        customerEmail,
        customerName,
        slot: slotTime,
        date: dateStr,
      })

      setOnAiTyping(false)

      setOnChats((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Intro call with ${brand}`,
          widget: 'meeting-booked',
          widgetData: {
            brandName: brand,
            date: dateStr,
            slot: slotTime,
            duration: '15 min',
          },
        },
        {
          role: 'assistant',
          content:
            'It was a pleasure interacting with you. One of our dedicated experts will contact you at your selected convenience.',
        },
        {
          role: 'assistant',
          content: 'Wishing you a wonderful day ahead.',
        },
        {
          role: 'assistant',
          content: 'This chat has ended!',
          widget: 'chat-ended',
        },
      ])
    } catch (err) {
      console.log('Error booking slot:', err)
      setOnAiTyping(false)
    }
  }

  // Restart chat from beginning
  const onRestartChat = () => {
    if (currentBot) {
      setOnChats(buildInitialMessages(currentBot))
    }
  }

  // Form submit handler (free text typed by user)
  const onStartChatting = handleSubmit(async (values) => {
    if (values.image?.length) {
      const uploaded = await upload.uploadFile(values.image[0])
      setOnChats((prev) => [
        ...prev,
        {
          role: 'user',
          content: uploaded.uuid,
        },
      ])

      setOnAiTyping(true)
      const response = await onAiChatBotAssistant(
        currentBotId!,
        onChats,
        'user',
        uploaded.uuid
      )

      setOnAiTyping(false)
      if (response) {
        if (response.live || response.chatRoom) {
          setOnRealTime({
            chatroom: response.chatRoom,
            mode: Boolean(response.live),
          })
        }
        if (response.response) {
          setOnChats((prev) => [...prev, response.response])
        }
      }
    }
    reset()

    if (values.content) {
      await handleSendMessage(values.content)
    }
  })

  return {
    botOpened,
    onOpenChatBot,
    onStartChatting,
    onSelectOption,
    onBookSlot,
    onRestartChat,
    onChats,
    register,
    onAiTyping,
    messageWindowRef,
    currentBot,
    loading,
    setOnChats,
    onRealTime,
    errors,
  }
}

export const useRealTime = (
  chatRoom: string,
  setChats: React.Dispatch<
    React.SetStateAction<ChatMessageType[]>
  >
) => {
  useEffect(() => {
    if (!chatRoom) return

    pusherClient.subscribe(chatRoom)
    pusherClient.bind('realtime-mode', (data: any) => {
      console.log('Realtime message received:', data)
      if (data?.chat) {
        setChats((prev) => [
          ...prev,
          {
            role: data.chat.role,
            content: data.chat.message,
          },
        ])
      }
    })

    return () => {
      pusherClient.unbind('realtime-mode')
      pusherClient.unsubscribe(chatRoom)
    }
  }, [chatRoom])
}
