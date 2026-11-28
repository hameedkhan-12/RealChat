import { onGetCurrentDomainInfo } from '@/actions/settings'
import InfoBar from '@/components/infobar'
import SettingsForm from '@/components/forms/settings/form'
import Link from 'next/link'
import React from 'react'

const DomainSettingsPage = async ({ params }: { params: Promise<{ domain: string }> }) => {
  const { domain } = await params
  const info = await onGetCurrentDomainInfo(domain)
  if (!info || !info.domains?.length) {
    return (
      <>
        <InfoBar />
        <div className="p-6">
          <h1 className="text-lg font-semibold mb-2">Domain not found</h1>
          <p className="text-sm text-muted-foreground mb-4">
            We couldn&apos;t load settings for &quot;{domain}&quot;. It may not exist, or your account may not be a member of it.
          </p>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </>
    )
  }
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
