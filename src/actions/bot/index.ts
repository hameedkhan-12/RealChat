'use server'

import { client } from '@/lib/prisma'

export const onGetCurrentChatBot = async (id: string) => {
  try {
    const domain = await client.domain.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        icon: true,
        chatBot: true,
        helpdesk: { select: { id: true, question: true, answer: true } },
      },
    })
    return domain ?? null
  } catch {
    return null
  }
}

export const onStoreConversations = async (
  id: string,
  message: string,
  role: 'VISITOR' | 'BOT' | 'AGENT' = 'VISITOR'
) => {
  try {
    await client.chatMessage.create({
      data: {
        chatRoomId: id,
        message,
        senderType: role,
      },
    })
  } catch {
    return
  }
}

// TODO(Phase 3): Replace with server-side flow engine in src/server/flow.ts
export const onAiChatBotAssistant = async (
  id: string,
  _chat: { role: string; content: string }[],
  _author: 'user',
  message: string
) => {
  try {
    const domain = await client.domain.findUnique({
      where: { id },
      select: { id: true, chatBot: { select: { welcomeMessage: true, offlineMessage: true, handoffEnabled: true } } },
    })
    if (!domain) return { response: { role: 'assistant', content: 'Chat is unavailable.' } }

    const lower = message.toLowerCase().trim()
    const wantsAgent =
      domain.chatBot?.handoffEnabled &&
      ['agent', 'human', 'representative', 'talk to a person', 'talk to someone'].some((k) =>
        lower.includes(k)
      )

    if (wantsAgent) {
      return { live: true, response: { role: 'assistant', content: domain.chatBot?.offlineMessage || 'Connecting you with a person now.' } }
    }

    return {
      response: {
        role: 'assistant',
        content:
          domain.chatBot?.welcomeMessage ||
          'Thanks for your message. Please configure your conversation flow to continue.',
      },
    }
  } catch {
    return {
      response: {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again shortly.',
      },
    }
  }
}
