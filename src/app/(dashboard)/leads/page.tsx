import { onGetLeads } from '@/actions/settings'
import InfoBar from '@/components/infobar'
import { LeadsClient } from './leads-client'

type LeadsPageProps = {
  searchParams: Promise<{ domain?: string }>
}

export default async function LeadsPage({
  searchParams,
}: LeadsPageProps) {
  const sp = await searchParams
  const domainId = typeof sp.domain === 'string' ? sp.domain : ''

  let leads: any[] = []
  if (domainId) {
    const res = await onGetLeads(domainId)
    if (res?.ok) {
      leads = (res.data as any).leads || []
    }
  }

  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <LeadsClient domainId={domainId} initialLeads={leads} />
      </div>
    </>
  )
}
