'use server'

import { client } from '@/lib/prisma'
import { extractEmailsFromString, extractURLfromString } from '@/lib/utils'
import { onRealTimeChat } from '../conversation'
import { clerkClient } from '@clerk/nextjs/server'
import { onMailer } from '../mailer'
import OpenAi from 'openai'
import { ChatMessageType } from '@/schemas/conversation.schema'
import { REAL_ESTATE_CONFIG } from '@/constants/real-estate-flow'

const openai = new OpenAi({
  apiKey: process.env.OPEN_AI_KEY,
})

export const onStoreConversations = async (
  id: string,
  message: string,
  role: 'assistant' | 'user'
) => {
  try {
    await client.chatRoom.update({
      where: { id },
      data: {
        message: {
          create: {
            message,
            role,
          },
        },
      },
    })
  } catch (e) {
    console.log('onStoreConversations error:', e)
  }
}

export const onGetCurrentChatBot = async (id: string) => {
  try {
    let domain = await client.domain.findUnique({
      where: { id },
      select: {
        id: true,
        icon: true,
        helpdesk: true,
        name: true,
        products: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        chatBot: {
          select: {
            id: true,
            welcomeMessage: true,
            icon: true,
            textColor: true,
            background: true,
            helpdesk: true,
          },
        },
      },
    })

    if (!domain) {
      domain = await client.domain.findFirst({
        where: {
          chatBot: { id },
        },
        select: {
          id: true,
          icon: true,
          helpdesk: true,
          name: true,
          products: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          chatBot: {
            select: {
              id: true,
              welcomeMessage: true,
              icon: true,
              textColor: true,
              background: true,
              helpdesk: true,
            },
          },
        },
      })
    }

    if (!domain) {
      domain = await client.domain.findFirst({
        select: {
          id: true,
          icon: true,
          helpdesk: true,
          name: true,
          products: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          chatBot: {
            select: {
              id: true,
              welcomeMessage: true,
              icon: true,
              textColor: true,
              background: true,
              helpdesk: true,
            },
          },
        },
      })
    }

    return domain
  } catch (error) {
    console.log('onGetCurrentChatBot error:', error)
  }
}

export const onAiChatBotAssistant = async (
  id: string,
  chat: ChatMessageType[],
  author: 'user',
  message: string,
  extra?: {
    customerName?: string
    customerEmail?: string
  }
) => {
  try {
    // 1. Resolve domain
    let domain = await client.domain.findUnique({
      where: { id },
      include: {
        products: true,
        chatBot: true,
        User: { select: { clerkId: true } },
      },
    })

    if (!domain) {
      domain = await client.domain.findFirst({
        where: { chatBot: { id } },
        include: {
          products: true,
          chatBot: true,
          User: { select: { clerkId: true } },
        },
      })
    }

    if (!domain) {
      domain = await client.domain.findFirst({
        include: {
          products: true,
          chatBot: true,
          User: { select: { clerkId: true } },
        },
      })
    }

    if (!domain) {
      return {
        response: {
          role: 'assistant' as const,
          content: 'Hello! How can I assist you today?',
        },
      }
    }

    // Determine brand name (from domain name, custom bot name, or fallback)
    const rawName = domain.name || ''
    const isLocalOrNgrok =
      rawName.includes('ngrok') ||
      rawName.includes('localhost') ||
      rawName.includes('127.0.0.1')
    const brandName = isLocalOrNgrok
      ? 'J7 Group'
      : rawName.split('.')[0].toUpperCase()

    // Project options (custom products if any, else luxury defaults)
    const domainProjects = domain.products?.map((p) => p.name) || []
    const availableProjects =
      domainProjects.length > 0
        ? domainProjects
        : REAL_ESTATE_CONFIG.defaultProjects

    // 2. Resolve Customer and ChatRoom
    const extractedEmail = extractEmailsFromString(message)?.[0]
    const emailInHistory = chat
      .map((c) => extractEmailsFromString(c.content || ''))
      .flat()
      .filter(Boolean)[0]
    const currentEmail =
      extractedEmail || emailInHistory || extra?.customerEmail

    let customer = null
    if (currentEmail) {
      customer = await client.customer.findFirst({
        where: { domainId: domain.id, email: currentEmail },
        include: { chatRoom: true },
      })
    }

    if (!customer) {
      // Find latest pending guest or create one
      const anonEmail = `guest-${Date.now()}@pending.local`
      customer = await client.customer.create({
        data: {
          email: anonEmail,
          domainId: domain.id,
          chatRoom: { create: {} },
        },
        include: { chatRoom: true },
      })
    }

    const chatRoomId = customer.chatRoom?.[0]?.id

    // Store incoming user message
    if (chatRoomId) {
      await onStoreConversations(chatRoomId, message, 'user')
      onRealTimeChat(chatRoomId, message, 'user', 'user')
    }

    // 3. If chatroom is already in live human mode, don't generate automated responses
    if (customer.chatRoom?.[0]?.live) {
      return {
        live: true,
        chatRoom: chatRoomId,
      }
    }

    // 4. Check for direct Agent Handover requests
    const lowerMessage = message.toLowerCase().trim()
    const isAgentRequest =
      lowerMessage.includes('agent') ||
      lowerMessage.includes('human') ||
      lowerMessage.includes('real user') ||
      lowerMessage.includes('talk to an agent') ||
      lowerMessage.includes('talk to someone') ||
      lowerMessage.includes('representative') ||
      lowerMessage === 'talk to an agent'

    if (isAgentRequest) {
      if (chatRoomId) {
        await client.chatRoom.update({
          where: { id: chatRoomId },
          data: { live: true },
        })
      }

      const response: ChatMessageType = {
        role: 'assistant',
        content:
          'Connecting you with a live agent. One of our dedicated property consultants will assist you shortly!',
      }

      if (chatRoomId) {
        await onStoreConversations(chatRoomId, response.content, 'assistant')
        onRealTimeChat(chatRoomId, response.content, 'assistant', 'assistant')
      }

      return {
        live: true,
        chatRoom: chatRoomId,
        response,
      }
    }

    // 5. Determine the last assistant message and its prompt
    const assistantMessages = chat.filter((m) => m.role === 'assistant')
    const lastAssistantMsg = assistantMessages[assistantMessages.length - 1]
    const lastPrompt = (lastAssistantMsg?.content || '').toLowerCase()

    let response: ChatMessageType

    // STEP 1: User just responded to intent (or no prior history)
    if (
      !lastAssistantMsg ||
      lastPrompt.includes('please select an option below to guide us') ||
      REAL_ESTATE_CONFIG.intentOptions.some(
        (opt) => opt.toLowerCase() === lowerMessage
      )
    ) {
      response = {
        role: 'assistant',
        content: 'What type of space would you like to enquire about?',
        options: REAL_ESTATE_CONFIG.spaceTypes,
        step: 'space_type',
      }
    }
    // STEP 2: User just selected Space Type
    else if (
      lastPrompt.includes('what type of space would you like to enquire about') ||
      REAL_ESTATE_CONFIG.spaceTypes.some(
        (st) => st.toLowerCase() === lowerMessage
      )
    ) {
      // Save answer
      try {
        await client.customerResponses.create({
          data: {
            customerId: customer.id,
            question: 'Space Type',
            answered: message,
          },
        })
      } catch {}

      response = {
        role: 'assistant',
        content: 'Could you kindly share your intended investment range?',
        options: REAL_ESTATE_CONFIG.investmentRanges,
        step: 'investment_range',
      }
    }
    // STEP 3: User just selected Investment Range
    else if (
      lastPrompt.includes('intended investment range') ||
      REAL_ESTATE_CONFIG.investmentRanges.some(
        (ir) => ir.toLowerCase() === lowerMessage
      )
    ) {
      // Save answer
      try {
        await client.customerResponses.create({
          data: {
            customerId: customer.id,
            question: 'Investment Range',
            answered: message,
          },
        })
      } catch {}

      response = {
        role: 'assistant',
        content: `Are you interested in any specific ${brandName} projects in Dubai?`,
        options: REAL_ESTATE_CONFIG.projectInterestOptions,
        step: 'project_interest',
      }
    }
    // STEP 4: Project Interest (Yes vs Explore All)
    else if (
      lastPrompt.includes('specific') &&
      lastPrompt.includes('projects in dubai')
    ) {
      if (lowerMessage === 'yes' || lowerMessage.includes('yes')) {
        response = {
          role: 'assistant',
          content: 'Kindly select your preferred project:',
          options: availableProjects,
          step: 'project_selection',
        }
      } else {
        response = {
          role: 'assistant',
          content:
            'Understood! We have an exceptional portfolio of premier waterfront and skyline residences.\n\nMay I have your full name?',
          step: 'name',
        }
      }
    }
    // STEP 4b: Specific Project Selection
    else if (lastPrompt.includes('preferred project')) {
      try {
        await client.customerResponses.create({
          data: {
            customerId: customer.id,
            question: 'Preferred Project',
            answered: message,
          },
        })
      } catch {}

      response = {
        role: 'assistant',
        content: 'Excellent choice! May I have your full name?',
        step: 'name',
      }
    }
    // STEP 5: Full Name provided
    else if (lastPrompt.includes('may i have your full name')) {
      try {
        await client.customerResponses.create({
          data: {
            customerId: customer.id,
            question: 'Full Name',
            answered: message,
          },
        })
      } catch {}

      response = {
        role: 'assistant',
        content:
          'May I have your email address so our investment advisory team can reach out to you?',
        step: 'email',
      }
    }
    // STEP 6: Email address provided -> Show In-Widget Slot Booking!
    else if (lastPrompt.includes('email address')) {
      if (extractedEmail) {
        // Upgrade customer with real email
        try {
          await client.customer.update({
            where: { id: customer.id },
            data: { email: extractedEmail },
          })
        } catch {}

        // Look back for the customer's name in history
        const nameMsg = [...chat]
          .reverse()
          .find((m, i, arr) => {
            const prev = arr[i + 1]
            return (
              prev?.role === 'assistant' &&
              prev?.content?.toLowerCase().includes('full name')
            )
          })
        const customerName = nameMsg?.content?.trim() || extra?.customerName || ''

        response = {
          role: 'assistant',
          content: `Thank you, ${
            customerName || 'there'
          }! Let's schedule an introductory call with one of our investment advisors:`,
          widget: 'slot-picker',
          step: 'slot_booking',
          widgetData: {
            brandName,
            email: extractedEmail,
            name: customerName,
          },
        }
      } else {
        response = {
          role: 'assistant',
          content:
            'Please provide a valid email address (e.g. name@example.com) so we can proceed with your enquiry.',
          step: 'email',
        }
      }
    }
    // ── FALLBACK / OPEN-ENDED QUESTIONS: Future AI layer or Live Agent Escalation ──
    else {
      let openAiResponseContent: string | null = null

      // Attempt AI completion if key is available
      if (process.env.OPEN_AI_KEY) {
        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are an expert, courteous luxury real estate advisor for ${brandName}. Answer briefly, professionally, and invite the user to schedule a discovery call or connect with a dedicated specialist.`,
              },
              ...chat.slice(-6).map((c) => ({
                role: c.role,
                content: c.content || '',
              })),
              { role: 'user', content: message },
            ],
          })
          openAiResponseContent = completion.choices[0]?.message?.content || null
        } catch (openAiErr: any) {
          console.log('OpenAI not available or quota exceeded:', openAiErr?.message)
        }
      }

      if (openAiResponseContent) {
        response = {
          role: 'assistant',
          content: openAiResponseContent,
          options: ['Interested in Owning', 'Schedule a Call', 'Talk to an Agent'],
        }
      } else {
        // Smoothly escalate to live human operator
        if (chatRoomId) {
          await client.chatRoom.update({
            where: { id: chatRoomId },
            data: { live: true },
          })
        }
        response = {
          role: 'assistant',
          content:
            "Thank you for your question. I am connecting you with one of our live real estate advisors who can provide you with comprehensive details right now.",
        }
      }
    }

    // Persist response and broadcast via Pusher
    if (chatRoomId) {
      await onStoreConversations(chatRoomId, response.content, 'assistant')
      onRealTimeChat(chatRoomId, response.content, 'assistant', 'assistant')
    }

    return {
      response,
      chatRoom: chatRoomId,
      live: response.content.toLowerCase().includes('connecting you with a live agent'),
    }
  } catch (error: any) {
    console.log('onAiChatBotAssistant error:', error)
    return {
      response: {
        role: 'assistant' as const,
        content:
          'Thank you for reaching out. A dedicated specialist will be with you shortly.',
      },
    }
  }
}
