import { client } from '@/lib/prisma'
import { onGetChatMessages, onGetCustomerAnswers, onTakeoverConversation, onCloseConversation, onReturnToBot } from '@/actions/conversation'
import { requireResourceAccess } from '@/lib/auth'
import InfoBar from '@/components/infobar'
import { ConversationHeader } from '@/components/dashboard/conversations/conversation-header'
import { CustomerPanel } from '@/components/dashboard/conversations/customer-panel'
import { ConversationRealtime } from '@/components/dashboard/conversations/conversation-realtime'
import { Separator } from '@/components/ui/separator'
import { notFound } from 'next/navigation'
import React from 'react'

type PageProps = {
  params: Promise<{ conversationId: string }>
}

export default async function ConversationDetailPage({
  params,
}: PageProps) {
  const { conversationId } = await params

  // Authorize access to this conversation (tenant-scoped)
  await requireResourceAccess('chatRoom', conversationId)

  // Load the room to get customerId and metadata
  const room = await client.chatRoom.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      status: true,
      domainId: true,
      assignedToUserId: true,
      customerId: true,
      lastActivityAt: true,
      createdAt: true,
      flowCompletedAt: true,
    },
  })

  if (!room) {
    notFound()
  }

  // Fetch messages and customer answers in parallel (both tenant-scoped)
  const [messagesRes, answersRes] = await Promise.all([
    onGetChatMessages(conversationId),
    onGetCustomerAnswers(room.customerId),
  ])

  // Resolve assigned agent name
  let assignedAgent = null
  if (room.assignedToUserId) {
    const user = await client.user.findUnique({
      where: { id: room.assignedToUserId },
      select: { id: true, fullname: true },
    })
    if (user) assignedAgent = { id: user.id, fullname: user.fullname }
  }

  const messagesData = messagesRes?.ok ? (messagesRes.data as any[]) : []
  const roomData = messagesData[0]
  const messages = roomData?.message ?? []
  const customer = roomData?.customer ?? { email: null, name: null, phone: null }

  const answersData = answersRes?.ok ? (answersRes.data as any) : null
  const questions = answersData?.questions ?? []
  const flowCompletedAt = room.flowCompletedAt

  const disabled = !(room.status === 'LIVE' && room.assignedToUserId)

  return (
    <div className="w-full h-full flex flex-col">
      <InfoBar />
      <div className="flex-1 flex overflow-hidden">
        {/* Left: header + realtime transcript + composer */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
          <ConversationHeader
            conversation={{
              id: conversationId,
              status: room.status,
              assignedToUserId: room.assignedToUserId,
              lastActivityAt: room.lastActivityAt,
              createdAt: room.createdAt,
              customer,
              flowCompletedAt: room.flowCompletedAt,
              assignedAgent,
            }}
          />
          <Separator orientation="horizontal" className="h-full" />
          <ConversationRealtime
            conversationId={conversationId}
            domainId={room.domainId}
            status={room.status}
            assignedToUserId={room.assignedToUserId}
            initialMessages={messages}
            disabled={disabled}
          />
        </div>

        {/* Right: customer panel */}
        <div className="w-[340px] border-l border-border flex flex-col overflow-hidden">
          <CustomerPanel
            customer={{
              id: room.customerId,
              email: customer.email,
              name: customer.name,
              phone: customer.phone,
              consentAt: answersData?.consentAt ?? null,
              chatRooms: answersData?.chatRooms ?? [],
            }}
            questions={questions}
            flowCompletedAt={room.flowCompletedAt}
          />
        </div>
      </div>
    </div>
  )
}
