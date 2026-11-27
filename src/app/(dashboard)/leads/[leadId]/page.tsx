import { onGetCustomerAnswers } from '@/actions/conversation'
import { requireResourceAccess } from '@/lib/auth'
import InfoBar from '@/components/infobar'
import { CustomerPanel } from '@/components/dashboard/conversations/customer-panel'
import { notFound } from 'next/navigation'
import React from 'react'

type PageProps = {
  params: Promise<{ leadId: string }>
}

export default async function LeadDetailPage({
  params,
}: PageProps) {
  const { leadId } = await params

  // Authorize access to this customer/lead (tenant-scoped)
  await requireResourceAccess('customer', leadId)

  const answersRes = await onGetCustomerAnswers(leadId)

  if (!answersRes?.ok) {
    notFound()
  }

  const answersData = answersRes.data as any
  if (!answersData) {
    notFound()
  }

  const customer = {
    id: leadId,
    email: answersData.email,
    name: answersData.name,
    phone: answersData.phone,
    consentAt: answersData.consentAt,
    chatRooms: answersData.chatRooms ?? [],
  }

  const questions = answersData.questions ?? []
  const flowCompletedAt =
    answersData.chatRooms?.find((r: any) => r.flowCompletedAt)?.flowCompletedAt ??
    null

  return (
    <div className="w-full h-full flex flex-col">
      <InfoBar />
      <div className="flex-1 flex overflow-hidden border-r border-border">
        <CustomerPanel
          customer={customer}
          questions={questions}
          flowCompletedAt={flowCompletedAt}
        />
      </div>
    </div>
  )
}
