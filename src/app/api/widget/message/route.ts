import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, readJson, assertSameOrigin, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireWidgetSession } from '@/lib/widget-auth'
import { MessageBody } from '@/lib/validation'
import { advanceFlow } from '@/server/flow'
import { aiProvider } from '@/server/ai'
import { getPusherServer, roomChannel } from '@/lib/pusher-server'

export const POST = handle(async (req: Request): Promise<Response> => {
  assertSameOrigin(req)
  const ip = getClientIp(req)
  const rl = await rateLimit(`msg:ip:${ip}`, 60, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { room } = await requireWidgetSession(req)
  const sessionRl = await rateLimit(`msg:room:${room.id}`, 60, 60)
  if (!sessionRl.success) throw new HttpError(429, 'RATE_LIMITED')

  const input = await readJson(req, MessageBody, 16_384)

  switch (input.kind) {
    case 'CONSENT': {
      if (!input.accepted) throw new HttpError(403, 'CONSENT_REQUIRED')
      await client.chatRoom.update({
        where: { id: room.id },
        data: { consentAt: new Date() },
      })
      if (room.customer) {
        await client.customer.update({
          where: { id: room.customer.id },
          data: { consentAt: new Date() },
        })
      }
      return await handleFlowStep(room, await advanceFlow(room.domainId, room.currentStepKey, undefined))
    }

    case 'FLOW_ANSWER': {
      if (room.status !== 'BOT') throw new HttpError(403, 'NOT_IN_BOT_MODE')
      if (!room.consentAt) throw new HttpError(403, 'CONSENT_REQUIRED')
      // Stale submission guard: client stepKey must match server-owned currentStepKey
      if (room.currentStepKey && input.stepKey !== room.currentStepKey) {
        throw new HttpError(409, 'STALE_SUBMISSION')
      }
      const result = await advanceFlow(room.domainId, room.currentStepKey, input.answer)
      if (result.kind === 'step') {
        const currentStep = await client.flowStep.findFirst({
          where: { domainId: room.domainId, key: room.currentStepKey ?? result.step.key },
        })
        if (currentStep && room.customer) {
          // Idempotent: skip if response already exists for this customer+step
          const existing = await client.customerResponses.findUnique({
            where: { customerId_stepKey: { customerId: room.customer.id, stepKey: currentStep.key } },
          })
          if (!existing) {
            await client.customerResponses.create({
              data: {
                customerId: room.customer.id,
                stepKey: currentStep.key,
                question: currentStep.prompt,
                answered: input.answer == null ? null : Array.isArray(input.answer) ? input.answer.join(', ') : String(input.answer),
              },
            })
            if (currentStep.mapsTo !== 'NONE' && input.answer != null) {
              const updateData: Record<string, string> = {}
              const val = Array.isArray(input.answer) ? input.answer.join(', ') : String(input.answer)
              if (currentStep.mapsTo === 'NAME') updateData.name = val
              if (currentStep.mapsTo === 'EMAIL') updateData.email = val
              if (currentStep.mapsTo === 'PHONE') updateData.phone = val
              await client.customer.update({ where: { id: room.customer.id }, data: updateData })
            }
          }
        }
        await client.chatRoom.update({
          where: { id: room.id },
          data: { currentStepKey: result.step.key, lastActivityAt: new Date() },
        })
        const botMsg = await client.chatMessage.create({
          data: {
            chatRoomId: room.id,
            message: result.step.prompt,
            senderType: 'BOT',
            kind: 'FLOW_PROMPT',
          },
        })
        await publishMessageEvent(room.id, botMsg.id)
        return NextResponse.json({
          ok: true,
          room: { status: room.status },
          messages: [{ id: botMsg.id, senderType: 'BOT', kind: 'FLOW_PROMPT', content: result.step.prompt }],
          currentStep: result.step,
          flowCompleted: false,
        })
      }
      await client.chatRoom.update({
        where: { id: room.id },
        data: { flowCompletedAt: new Date(), lastActivityAt: new Date() },
      })
      const chatBot = await client.chatBot.findUnique({ where: { domainId: room.domainId } })
      const actions = []
      if (chatBot?.bookingEnabled) actions.push({ type: 'book', label: 'Book a call' })
      if (chatBot?.handoffEnabled) actions.push({ type: 'handoff', label: 'Talk to a person' })
      actions.push({ type: 'finish', label: 'No thanks' })
      return NextResponse.json({
        ok: true,
        room: { status: room.status },
        messages: [],
        currentStep: null,
        flowCompleted: true,
        actions,
      })
    }

    case 'QUESTION': {
      if (room.status !== 'BOT') throw new HttpError(403, 'NOT_IN_BOT_MODE')
      if (!room.consentAt) throw new HttpError(403, 'CONSENT_REQUIRED')

      // Save visitor question
      const visitorMsg = await client.chatMessage.create({
        data: { chatRoomId: room.id, message: input.content, senderType: 'VISITOR' },
      })
      await client.chatRoom.update({ where: { id: room.id }, data: { lastActivityAt: new Date() } })
      await publishMessageEvent(room.id, visitorMsg.id)

      // Retrieve active knowledge for this domain (simple keyword matching)
      const knowledge = await client.knowledgeItem.findMany({
        where: { domainId: room.domainId, isActive: true },
        select: { id: true, title: true, content: true },
        take: 5,
      })

      let aiAnswer: string
      let aiEscalate = false
      let usedKnowledgeIds: string[] = []

      if (knowledge.length > 0) {
        const grounded = await aiProvider.answerFromKnowledge({
          question: input.content,
          knowledge: knowledge.map((k) => ({ title: k.title, content: k.content })),
          locale: room.locale ?? 'en',
        })
        aiAnswer = grounded.answer
        aiEscalate = grounded.shouldEscalate
        usedKnowledgeIds = knowledge.map((k) => k.id)
      } else {
        aiAnswer = `I don't have confirmed information about that. A team member can help you.`
        aiEscalate = true
      }

      // Re-check room status before persisting AI response (agent may have taken over)
      const freshRoom = await client.chatRoom.findUnique({
        where: { id: room.id },
        select: { id: true, status: true },
      })
      if (!freshRoom || freshRoom.status !== 'BOT') {
        // Discard AI output; agent owns the room now
        return NextResponse.json({
          ok: true,
          room: { status: freshRoom?.status ?? room.status },
          messages: [{ id: visitorMsg.id, senderType: 'VISITOR', content: input.content }],
          currentStep: null,
          flowCompleted: false,
        })
      }

      const aiMsg = await client.chatMessage.create({
        data: {
          chatRoomId: room.id,
          message: aiAnswer,
          senderType: 'BOT',
          kind: 'AI_ANSWER',
          metadata: { knowledgeIds: usedKnowledgeIds, escalate: aiEscalate },
        },
      })
      await publishMessageEvent(room.id, aiMsg.id)

      return NextResponse.json({
        ok: true,
        room: { status: 'BOT' },
        messages: [
          { id: visitorMsg.id, senderType: 'VISITOR', content: input.content },
          { id: aiMsg.id, senderType: 'BOT', kind: 'AI_ANSWER', content: aiAnswer },
        ],
        currentStep: null,
        flowCompleted: false,
      })
    }
  }

  throw new HttpError(400, 'VALIDATION', { issues: [{ path: ['kind'], message: 'Unknown message kind' }] })
})

async function handleFlowStep(
  room: { domainId: string; currentStepKey: string | null; id: string; status: string },
  result: { kind: string; step?: { key: string; prompt: string } }
): Promise<Response> {
  if (result.kind === 'step' && result.step) {
    await client.chatRoom.update({
      where: { id: room.id },
      data: { currentStepKey: result.step.key, lastActivityAt: new Date() },
    })
    const botMsg = await client.chatMessage.create({
      data: { chatRoomId: room.id, message: result.step.prompt, senderType: 'BOT', kind: 'FLOW_PROMPT' },
    })
    await publishMessageEvent(room.id, botMsg.id)
    return NextResponse.json({
      ok: true,
      room: { status: room.status },
      messages: [{ id: botMsg.id, senderType: 'BOT', kind: 'FLOW_PROMPT', content: result.step.prompt }],
      currentStep: result.step,
      flowCompleted: false,
    })
  }
  await client.chatRoom.update({
    where: { id: room.id },
    data: { flowCompletedAt: new Date(), lastActivityAt: new Date() },
  })
  return NextResponse.json({
    ok: true,
    room: { status: room.status },
    messages: [],
    currentStep: null,
    flowCompleted: true,
  })
}

async function publishMessageEvent(roomId: string, messageId: string) {
  const pusher = getPusherServer()
  if (!pusher) return
  try {
    await pusher.trigger(roomChannel(roomId), 'message.created', { roomId, messageId })
  } catch {
    // Pusher failure must not roll back a committed message
  }
}
