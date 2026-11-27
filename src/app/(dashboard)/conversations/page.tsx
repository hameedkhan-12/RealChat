import { onGetAllAccountDomains } from '@/actions/settings'
import { onGetDomainChatRooms } from '@/actions/conversation'
import { ChatRoomItem } from '@/actions/conversation'
import InfoBar from '@/components/infobar'
import { DomainSelector } from './domain-selector'
import { DashboardConversationQuerySchema } from '@/lib/validations/dashboard/conversation-query.schema'

const STATUS_LABELS: Record<string, string> = {
  BOT: 'Bot',
  WAITING_AGENT: 'Waiting Agent',
  LIVE: 'Live',
  CLOSED: 'Closed',
}

const STATUS_COLORS: Record<string, string> = {
  BOT: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  WAITING_AGENT: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  LIVE: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
}

type StatusFilter = 'WAITING_AGENT' | 'LIVE' | 'CLOSED' | 'BOT' | undefined

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'WAITING_AGENT', label: 'Waiting Agent' },
  { value: 'LIVE', label: 'Live' },
  { value: 'CLOSED', label: 'Closed' },
]

function buildUrl(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, value)
    }
  }
  const qs = searchParams.toString()
  return qs ? `?${qs}` : '?'
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; room?: string; cursor?: string; status?: string; search?: string }>
}) {
  const sp = await searchParams
  const domainId = typeof sp.domain === 'string' ? sp.domain : ''
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : undefined
  const status = sp.status as StatusFilter | undefined
  const search = typeof sp.search === 'string' ? sp.search : ''

  DashboardConversationQuerySchema.safeParse({
    domain: sp.domain,
    status: sp.status,
    search: sp.search,
    cursor: sp.cursor,
  })

  const account = await onGetAllAccountDomains()
  const domains = account?.domains ?? []

  let rooms: ChatRoomItem[] = []
  let nextCursor: string | null = null
  if (domainId) {
    const data = await onGetDomainChatRooms(domainId, status, search || undefined, cursor, 20)
    if (data?.ok && data.data) {
      rooms = data.data.items
      nextCursor = data.data.nextCursor
    }
  }

  const baseParams: Record<string, string | undefined> = {
    domain: domainId || undefined,
    status: status ?? undefined,
    search: search || undefined,
  }

  return (
    <div className="w-full h-full flex flex-col">
      <InfoBar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-4 bg-muted/50">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Domain:</span>
            <DomainSelector domains={domains} defaultValue={domainId} />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-medium text-muted-foreground">Status filter:</span>
            <div className="flex gap-1">
              {STATUS_FILTERS.map((f) => {
                const isActive = f.value === status
                return (
                  <a
                    key={f.label}
                    href={buildUrl({ ...baseParams, status: f.value, cursor: undefined })}
                    className={`px-2 py-1 rounded text-sm border ${isActive ? 'bg-blue-100 text-blue-700 border-blue-200' : 'border-transparent hover:bg-muted/50'}`}
                  >
                    {f.label} ({f.value === undefined ? rooms.length : rooms.filter((r) => r.status === f.value).length})
                  </a>
                )
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b flex items-center gap-2 bg-muted/50">
          <form
            action={buildUrl({ ...baseParams, cursor: undefined })}
            method="GET"
            className="flex items-center gap-2 flex-1"
          >
            <input
              name="search"
              defaultValue={search}
              placeholder="Search customer name or email..."
              className="flex-1 px-3 py-1.5 rounded border text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded border text-sm hover:bg-muted"
            >
              Search
            </button>
            {search && (
              <a
                href={buildUrl({ ...baseParams, search: undefined, cursor: undefined })}
                className="px-2 py-1.5 rounded border text-xs hover:bg-muted"
              >
                Clear
              </a>
            )}
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-bold">Conversations</h2>
            <span className="text-xs font-medium text-muted-foreground">{rooms.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {rooms.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No conversations</div>
            ) : (
              rooms.map((r) => (
                <a
                  key={r.id}
                  href={buildUrl({ ...baseParams, room: r.id, cursor: undefined })}
                  className="block p-3 rounded-lg border transition-colors border-transparent hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold uppercase ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                      {r.assignedToUserId && <span className="text-[10px] text-muted-foreground">• {r.assignedToUserId}</span>}
                    </div>
                    <div className="text-sm font-medium truncate">{r.customer.name || r.customer.email || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.latestMessage || 'No messages'}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{new Date(r.lastActivityAt || r.createdAt).toLocaleString()}</div>
                  </div>
                </a>
              ))
            )}
          </div>
          {nextCursor && (
            <div className="p-2">
              <a
                href={buildUrl({ ...baseParams, cursor: nextCursor })}
                className="w-full px-4 py-2 text-sm border rounded hover:bg-muted block"
              >
                Load more
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
