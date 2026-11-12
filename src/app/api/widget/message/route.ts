import { NextResponse } from 'next/server'
import { client } from '@/lib/prisma'
import { hashToken, getBearerToken } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { advanceFlow, getFlowSteps } from '@/server/flow'

export const POST = async (req: Request) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const rl = await rateLimit(`msg:${ip}`, 60, 60)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null
  if (!token) return NextResponse.json({ error: 'Missing session token' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { content, stepKey, answer, consent } = body || {}
  if (!content && !answer) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const tokenHash = hashToken(token)
  const room = await client.chatRoom.findFirst({
    where: { sessionTokenHash: tokenHash },
    include: { customer: true },
  })
  if (!room) return NextResponse.json({ error: 'Invalid session' }, { status: 403 })

  // Store visitor message
  await client.chatMessage.create({
    data: { chatRoomId: room.id, message: content ?? '', senderType: 'VISITOR' },
  })

  // Consent capture before any personal data
  if (consent && !room.consentAt) {
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
  }

  // Save answer to CustomerResponses with stepKey, and map to Customer field if applicable
  if (answer !== undefined && answer !== null && room.customer) {
    const currentStep = await client.flowStep.findFirst({
      where: { domainId: room.domainId, key: stepKey },
    })
    if (currentStep) {
      await client.customerResponses.create({
        data: { customerId: room.customer.id, stepKey: currentStep.key, question: currentStep.prompt, answered: String(answer) },
      })
      if (currentStep.mapsTo !== 'NONE') {
        const updateData: Record<string, string> = {}
        if (currentStep.mapsTo === 'NAME') updateData.name = String(answer)
        if (currentStep.mapsTo === 'EMAIL') updateData.email = String(answer)
        if (currentStep.mapsTo === 'PHONE') updateData.phone = String(answer)
        await client.customer.update({ where: { id: room.customer.id }, data: updateData })
      }
    }
  }

  // Advance flow
  const result = await advanceFlow(room.domainId, room.currentStepKey, answer !== undefined ? String(answer) : undefined)

  // Update currentStepKey if we have a next step
  if (result.kind === 'step') {
    await client.chatRoom.update({
      where: { id: room.id },
      data: { currentStepKey: result.step.key, lastActivityAt: new Date() },
    })
    // Save bot response message
    await client.chatMessage.create({
      data: { chatRoomId: room.id, message: result.step.prompt, senderType: 'BOT' },
    })
    return NextResponse.json({
      ok: true,
      kind: 'step',
      step: result.step,
      chatRoomId: room.id,
    })
  }

  // Completion
  await client.chatRoom.update({
    where: { id: room.id },
    data: { status: 'CLOSED', lastActivityAt: new Date() },
  })

  const chatBot = await client.chatBot.findUnique({ where: { domainId: room.domainId } })
  const actions = []
  if (chatBot?.bookingEnabled) actions.push({ type: 'book', label: 'Book a call' })
  if (chatBot?.handoffEnabled) actions.push({ type: 'handoff', label: 'Talk to a person' })
  actions.push({ type: 'finish', label: 'No thanks' })

  // Notify tenant via email (notificationEmails)
  const emails = (room.domainId ? await client.domain.findUnique({ where: { id: room.domainId }, select: { notificationEmails: true } }) : null)?.notificationEmails ?? []
  if (emails.length && room.customer) {
    try {
      const { sendMail } = await import('@/actions/mailer')
      await sendMail({
        to: emails,
        subject: 'New chat lead completed',
        text: `A visitor completed the chat flow for domain ${room.domainId}. Customer: ${room.customer.email ?? room.customer.name ?? 'unknown'}`,
      })
    } catch {
      // email failure should not break the flow
    }

    return NextResponse.json({
      ok: true,
      kind: 'complete',
      step: null,
      chatRoomId: room.id,
      actions,
      customer: { email: room.customer.email, name: room.customer.name, phone: room.customer.phone },
    })
  }

  return NextResponse.json({
    ok: true,
    kind: 'complete',
    step: null,
    chatRoomId: room.id,
    actions,
    customer: room.customer ? { email: room.customer.email, name: room.customer.name, phone: room.customer.phone } : null,
  })
}
