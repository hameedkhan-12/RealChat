import { onGetCurrentDomainInfo } from '@/actions/settings'
import InfoBar from '@/components/infobar'
import SettingsForm from '@/components/forms/settings/form'
import { redirect } from 'next/navigation'
import React from 'react'

const DomainSettingsPage = async ({ params }: { params: Promise<{ domain: string }> }) => {
  const { domain } = await params
  const info = await onGetCurrentDomainInfo(domain)
  if (!info || !info.domains?.length) redirect('/dashboard')
  const d = info.domains[0] as any
  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <SettingsForm id={d.id} name={d.name} plan={'STANDARD'} chatBot={d.chatBot} />
      </div>
    </>
  )
}

export default DomainSettingsPage