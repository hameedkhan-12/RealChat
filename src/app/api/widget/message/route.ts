import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { handle, readJson, assertSameOrigin, HttpError } from '@/lib/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requireWidgetSession } from '@/lib/widget-auth'
import { MessageBody } from '@/lib/validation'
import { advanceFlow } from '@/server/flow'

export const POST = handle(async (req: Request): Promise<Response> => {
  assertSameOrigin(req)
  const ip = getClientIp(req)
  const rl = await rateLimit(`msg:ip:${ip}`, 60, 60)
  if (!rl.success) throw new HttpError(429, 'RATE_LIMITED')

  const { room } = await requireWidgetSession(req)
  const sessionRl = await rateLimit(`msg:room:${room.id}`, 60, 60)
  if (!sessionRl.success) throw new HttpError(429, 'RATE_LIMITED')

  const input = await readJson(req, MessageBody, 16_384)

  switch (input.type) {
    case 'consent': {
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
      return await handleStepOrComplete(room, await advanceFlow(room.domainId, room.currentStepKey, undefined))
    }

    case 'finish': {
      await client.chatRoom.update({
        where: { id: room.id },
        data: { status: 'CLOSED', lastActivityAt: new Date() },
      })
      return NextResponse.json({ ok: true, kind: 'complete', step: null, chatRoomId: room.id })
    }

    case 'text': {
      await client.chatMessage.create({
        data: { chatRoomId: room.id, message: input.text, senderType: 'VISITOR' },
      })
      await client.chatRoom.update({ where: { id: room.id }, data: { lastActivityAt: new Date() } })
      return NextResponse.json({ ok: true, kind: 'text', chatRoomId: room.id })
    }

    case 'answer': {
      const result = await advanceFlow(room.domainId, room.currentStepKey, input.answer)
      if (result.kind === 'step') {
        if (room.currentStepKey && room.customer) {
          const currentStep = await client.flowStep.findFirst({
            where: { domainId: room.domainId, key: room.currentStepKey },
          })
          if (currentStep) {
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
        await client.chatMessage.create({
          data: { chatRoomId: room.id, message: result.step.prompt, senderType: 'BOT' },
        })
        return NextResponse.json({ ok: true, kind: 'step', step: result.step, chatRoomId: room.id })
      }
      await client.chatRoom.update({
        where: { id: room.id },
        data: { status: 'CLOSED', flowCompletedAt: new Date(), lastActivityAt: new Date() },
      })
      const chatBot = await client.chatBot.findUnique({ where: { domainId: room.domainId } })
      const actions = []
      if (chatBot?.bookingEnabled) actions.push({ type: 'book', label: 'Book a call' })
      if (chatBot?.handoffEnabled) actions.push({ type: 'handoff', label: 'Talk to a person' })
      actions.push({ type: 'finish', label: 'No thanks' })
      return NextResponse.json({
        ok: true,
        kind: 'complete',
        step: null,
        chatRoomId: room.id,
        actions,
      })
    }
  }

  throw new HttpError(400, 'VALIDATION', { issues: [{ path: ['type'], message: 'Unknown message type' }] })
})

async function handleStepOrComplete(room: { domainId: string; currentStepKey: string | null; id: string }, result: { kind: string; step?: { key: string; prompt: string } }): Promise<Response> {
  if (result.kind === 'step' && result.step) {
    await client.chatRoom.update({
      where: { id: room.id },
      data: { currentStepKey: result.step.key, lastActivityAt: new Date() },
    })
    await client.chatMessage.create({
      data: { chatRoomId: room.id, message: result.step.prompt, senderType: 'BOT' },
    })
    return NextResponse.json({ ok: true, kind: 'step', step: result.step, chatRoomId: room.id })
  }
  await client.chatRoom.update({
    where: { id: room.id },
    data: { status: 'CLOSED', lastActivityAt: new Date() },
  })
  return NextResponse.json({ ok: true, kind: 'complete', step: null, chatRoomId: room.id })
}
