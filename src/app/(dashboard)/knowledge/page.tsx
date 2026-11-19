import { onGetLeads } from '@/actions/settings'
import { onGetKnowledgeItems, onUpsertKnowledgeItem, onDeleteKnowledgeItem } from '@/actions/knowledge'
import { onGetAllAccountDomains } from '@/actions/settings'
import InfoBar from '@/components/infobar'
import { KnowledgeClient } from './knowledge-client'

type KnowledgePageProps = {
  searchParams: Promise<{ domain?: string }>
}

export default async function KnowledgePage({
  searchParams,
}: KnowledgePageProps) {
  const sp = await searchParams
  const domainId = typeof sp.domain === 'string' ? sp.domain : ''

  const account = await onGetAllAccountDomains()
  const domains = account?.domains ?? []

  let items: any[] = []
  if (domainId) {
    const res = await onGetKnowledgeItems(domainId)
    if (res?.ok) {
      items = (res.data as any).items || []
    }
  }

  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <KnowledgeClient domainId={domainId} domains={domains} initialItems={items} />
      </div>
    </>
  )
}
