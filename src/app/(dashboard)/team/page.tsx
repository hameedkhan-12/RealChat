import { onGetAllAccountDomains, onGetDomainMembers, onInviteAgent, onRemoveTeamMember } from '@/actions/settings'
import InfoBar from '@/components/infobar'
import { TeamClient } from './team-client'

type TeamPageProps = {
  searchParams: Promise<{ domain?: string }>
}

export default async function TeamPage({
  searchParams,
}: TeamPageProps) {
  const sp = await searchParams
  let domainId = typeof sp.domain === 'string' ? sp.domain : ''

  let members: any[] = []
  if (domainId) {
    const res = await onGetDomainMembers(domainId)
    if (res?.ok) {
      members = (res.data as any).members || []
    }
  }

  // Auto-select the user's first domain when none is specified
  if (!domainId) {
    const account = await onGetAllAccountDomains()
    const domains = account?.domains ?? []
    if (domains.length > 0) {
      domainId = domains[0].id
      const res = await onGetDomainMembers(domainId)
      if (res?.ok) {
        members = (res.data as any).members || []
      }
    }
  }

  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <TeamClient domainId={domainId} initialMembers={members} />
      </div>
    </>
  )
}
