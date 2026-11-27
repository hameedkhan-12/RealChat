import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, readJson, assertSameOrigin, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireWidgetSession } from '@/lib/widget-auth'
import { MessageBody } from '@/lib/validation'
import { advanceFlow, type FlowAnswer } from '@/server/flow'
import { generateGroundedAnswer } from '@/server/ai-answer'
import { retrieveKnowledge } from '@/server/knowledge-retrieval'
import { getPusherServer, roomChannel } from '@/lib/pusher-server'

export const POST = handle(async (req: Request): Promise<Response> => {
  assertSameOrigin(req)
  const ip = getClientIp(req)
  const rl = await rateLimit(`msg:ip:${ip}`, 60, 60, true)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { room } = await requireWidgetSession(req)
  const sessionRl = await rateLimit(`msg:room:${room.id}`, 60, 60, true)
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
      return await handleFlowStep(room, await advanceFlow(client, room.domainId, room.currentStepKey, undefined))
    }

    case 'FLOW_ANSWER': {
      if (room.status !== 'BOT') throw new HttpError(403, 'NOT_IN_BOT_MODE')
      if (!room.consentAt) throw new HttpError(403, 'CONSENT_REQUIRED')
      if (!room.customer) throw new HttpError(403, 'NO_CUSTOMER')

      // Stale submission guard: client stepKey must match server-owned currentStepKey
      if (room.currentStepKey && input.stepKey !== room.currentStepKey) {
        throw new HttpError(409, 'STALE_SUBMISSION')
      }

      const result = await client.$transaction(async (tx) => {
        // Idempotency: if a response already exists for this room+step, return saved state
        const existing = await tx.customerResponses.findUnique({
          where: { roomId_stepKey: { roomId: room.id, stepKey: input.stepKey } },
          select: { stepKey: true, answered: true },
        })
        if (existing) {
          const currentStep = await tx.flowStep.findFirst({
            where: { domainId: room.domainId, key: input.stepKey },
            select: { key: true, prompt: true, type: true, required: true, options: true },
          })
          return {
            kind: 'step' as const,
            step: currentStep
              ? {
                  key: currentStep.key,
                  question: currentStep.prompt,
                  type: currentStep.type,
                  required: currentStep.required,
                  options: Array.isArray(currentStep.options)
                    ? (currentStep.options as { value: string }[]).map((o) => o.value)
                    : null,
                }
              : null,
            savedAnswer: { stepKey: input.stepKey, answer: existing.answered },
            alreadyAnswered: true,
          }
        }

        // Validate answer against current step using flow engine (inside transaction)
        const flowResult = await advanceFlow(tx, room.domainId, room.currentStepKey, input.answer as FlowAnswer)

        const normalizeAnswer = (a: typeof input.answer) =>
          a == null ? null : Array.isArray(a) ? a.join(', ') : String(a)

        if (flowResult.kind === 'step') {
          const step = flowResult.step

          // Upsert answer (idempotent via compound unique constraint roomId_stepKey)
          await tx.customerResponses.upsert({
            where: { roomId_stepKey: { roomId: room.id, stepKey: input.stepKey! } },
            create: {
              roomId: room.id,
              customerId: room.customer!.id,
              stepKey: input.stepKey!,
              question: step.prompt,
              answered: normalizeAnswer(input.answer),
            },
            update: {
              answered: normalizeAnswer(input.answer),
            },
          })

          // Update customer name/email/phone if mapsTo
          if (step.mapsTo !== 'NONE' && input.answer != null) {
            const val = normalizeAnswer(input.answer) as string
            const updateData: Record<string, string> = {}
            if (step.mapsTo === 'NAME') updateData.name = val
            if (step.mapsTo === 'EMAIL') updateData.email = val
            if (step.mapsTo === 'PHONE') updateData.phone = val
            await tx.customer.update({ where: { id: room.customer!.id }, data: updateData })
          }

          // Advance step
          await tx.chatRoom.update({
            where: { id: room.id },
            data: { currentStepKey: step.key, lastActivityAt: new Date() },
          })

          // Create bot message for next step
          const botMsg = await tx.chatMessage.create({
            data: {
              chatRoomId: room.id,
              message: step.prompt,
              senderType: 'BOT',
              kind: 'FLOW_PROMPT',
            },
          })

          return {
            kind: 'step' as const,
            step: {
              key: step.key,
              question: step.prompt,
              type: step.type,
              required: step.required,
              options: step.options ? step.options.map((o) => o.value) : undefined,
            },
            savedAnswer: { stepKey: input.stepKey, answer: input.answer },
            botMessageId: botMsg.id,
          }
        } else {
          // Flow complete: persist final answer, set flowCompletedAt (status stays BOT)
          await tx.customerResponses.upsert({
            where: { roomId_stepKey: { roomId: room.id, stepKey: input.stepKey } },
            create: {
              roomId: room.id,
              customerId: room.customer.id,
              stepKey: input.stepKey,
              question: '',
              answered: normalizeAnswer(input.answer),
            },
            update: {
              answered: normalizeAnswer(input.answer),
            },
          })

          await tx.chatRoom.update({
            where: { id: room.id },
            data: { flowCompletedAt: new Date(), lastActivityAt: new Date() },
          })

          return { kind: 'complete' as const, savedAnswer: { stepKey: input.stepKey!, answer: input.answer } }
        }
      })

      if (result.kind === 'step') {
        await publishMessageEvent(room.id, result.botMessageId as string)
        return NextResponse.json({
          ok: true,
          flowCompleted: false,
          currentStep: result.step ?? undefined,
          savedAnswer: result.savedAnswer,
          room: { status: room.status },
          messages: [
            {
              id: result.botMessageId,
              senderType: 'BOT',
              kind: 'FLOW_PROMPT',
              content: result.step?.question ?? '',
            },
          ],
        })
      }

      const chatBot = await client.chatBot.findUnique({ where: { domainId: room.domainId } })
      const actions = []
      if (chatBot?.bookingEnabled) actions.push({ type: 'book', label: 'Book a call' })
      if (chatBot?.handoffEnabled) actions.push({ type: 'handoff', label: 'Talk to a person' })
      actions.push({ type: 'finish', label: 'No thanks' })
      return NextResponse.json({
        ok: true,
        flowCompleted: true,
        currentStep: null,
        savedAnswer: result.savedAnswer,
        room: { status: room.status },
        messages: [],
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

      // Retrieve active knowledge for this domain, ranked by keyword relevance
      const retrieval = await retrieveKnowledge({
        domainId: room.domainId,
        question: input.content,
      })

      // Determine locale: visitor preference -> app fallback ('en')
      const locale = input.locale || 'en'

      // Generate grounded AI answer using only retrieved knowledge
      const aiResult = await generateGroundedAnswer({
        question: input.content,
        knowledge: retrieval.candidates,
        locale,
      })

      // Atomically claim the room for AI response and persist the AI message in one
      // transaction. The UPDATE takes a row lock on the chatRoom, so a concurrent
      // takeover either happens before (claim count 0 -> discard) or blocks until we
      // commit (then fails because status is no longer WAITING_AGENT). This prevents
      // a stale AI response from being saved after a human has taken ownership.
      let aiMsg: { id: string } | null = null
      try {
        aiMsg = await client.$transaction(async (tx) => {
          const claim = await tx.chatRoom.updateMany({
            where: { id: room.id, status: 'BOT' },
            data: { lastActivityAt: new Date() },
          })
          if (claim.count === 0) {
            // No longer BOT (agent took over or room closed): roll back and discard.
            const err = new Error('AI_NO_LONGER_OWNS_CONVERSATION')
            ;(err as any).aiDiscard = true
            throw err
          }
          return tx.chatMessage.create({
            data: {
              chatRoomId: room.id,
              message: aiResult.answer,
              senderType: 'BOT',
              kind: 'AI_ANSWER',
              metadata: {
                knowledgeIds: aiResult.usedKnowledgeIds,
                escalate: aiResult.canAnswer ? false : true,
                abstainReason: aiResult.abstainReason,
              },
            },
            select: { id: true },
          })
        })
      } catch (e) {
        if ((e as any)?.aiDiscard) {
          const freshRoom = await client.chatRoom.findUnique({
            where: { id: room.id },
            select: { status: true },
          })
          return NextResponse.json({
            ok: true,
            room: { status: freshRoom?.status ?? room.status },
            messages: [{ id: visitorMsg.id, senderType: 'VISITOR', content: input.content }],
            currentStep: null,
            flowCompleted: false,
          })
        }
        throw e
      }
      // Publish only after the AI message has been committed.
      await publishMessageEvent(room.id, aiMsg!.id)

      return NextResponse.json({
        ok: true,
        room: { status: 'BOT' },
        messages: [
          { id: visitorMsg.id, senderType: 'VISITOR', content: input.content },
          { id: aiMsg.id, senderType: 'BOT', kind: 'AI_ANSWER', content: aiResult.answer },
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
