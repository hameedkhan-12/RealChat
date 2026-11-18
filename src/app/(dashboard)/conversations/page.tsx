import { onGetAllAccountDomains } from '@/actions/settings'
import { onGetDomainChatRooms, onGetCustomerAnswers, onCloseConversation, onReturnToBot } from '@/actions/conversation'
import { ChatRoomItem } from '@/actions/conversation'
import InfoBar from '@/components/infobar'
import { Separator } from '@/components/ui/separator'
import { DomainSelector } from './domain-selector'

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

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; room?: string; cursor?: string }>
}) {
  const sp = await searchParams
  const domainId = typeof sp.domain === 'string' ? sp.domain : ''
  const selectedRoomId = typeof sp.room === 'string' ? sp.room : ''
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : undefined

  const account = await onGetAllAccountDomains()
  const domains = account?.domains ?? []

  let rooms: ChatRoomItem[] = []
  let nextCursor: string | null = null
  if (domainId) {
    const data = await onGetDomainChatRooms(domainId, undefined, cursor, 20)
    if (data?.ok && data.data) {
      rooms = data.data.items
      nextCursor = data.data.nextCursor
    }
  }

  const waitingCount = rooms.filter((r) => r.status === 'WAITING_AGENT').length
  const liveCount = rooms.filter((r) => r.status === 'LIVE').length

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId)
  let customerAnswers: any = null
  if (selectedRoom) {
    const res = await onGetCustomerAnswers(selectedRoom?.customer.id)
    if (res?.ok) customerAnswers = res.data
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
              <button className="px-2 py-1 rounded text-sm border">All</button>
              <button className="px-2 py-1 rounded text-sm border">Waiting ({waitingCount})</button>
              <button className="px-2 py-1 rounded text-sm border">Live ({liveCount})</button>
              <button className="px-2 py-1 rounded text-sm border">Closed</button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-[400px] border-r border-border flex flex-col overflow-hidden">
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
                    href={`?domain=${domainId}&room=${r.id}`}
                    className={`block p-3 rounded-lg border transition-colors ${selectedRoomId === r.id ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' : 'border-transparent hover:bg-muted/50'}`}
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
                <button
                  onClick={() => {
                    const url = new URL(window.location.href)
                    url.searchParams.set('cursor', nextCursor)
                    window.location.href = url.toString()
                  }}
                  className="w-full px-4 py-2 text-sm border rounded hover:bg-muted"
                >
                  Load more
                </button>
              </div>
            )}
          </div>

          <Separator orientation="vertical" className="h-full" />
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedRoomId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <h2 className="text-lg font-medium mb-2">Select a conversation</h2>
                <p className="text-sm">Pick a conversation from the list to view transcript and respond.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold">{selectedRoom?.customer.name || 'Conversation'}</h2>
                    <p className="text-xs text-muted-foreground">{selectedRoom?.customer.email || ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedRoom && selectedRoom.status === 'LIVE' && (
                      <form action={async () => {
                        await onReturnToBot(selectedRoom.id)
                        window.location.reload()
                      }} className="inline">
                        <button className="px-3 py-1.5 text-xs border rounded bg-amber-50 text-amber-700 hover:bg-amber-100">Return to Bot</button>
                      </form>
                    )}
                    {selectedRoom && selectedRoom.status === 'LIVE' && (
                      <form action={async () => {
                        await onCloseConversation(selectedRoom.id)
                        window.location.reload()
                      }} className="inline">
                        <button className="px-3 py-1.5 text-xs border rounded bg-red-50 text-red-700 hover:bg-red-100">Close</button>
                      </form>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <p className="text-sm text-muted-foreground text-center py-10">
                    Messages are displayed in the conversation view. Select a conversation to see its transcript.
                  </p>
                </div>
              </div>
            )}
          </div>

          {customerAnswers && (
            <div className="w-[320px] border-l border-border bg-muted/50 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b"><h2 className="text-sm font-bold">Lead Details</h2></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">Contact</h3>
                  <p className="text-sm">{customerAnswers.email}</p>
                  {customerAnswers.name && <p className="text-sm">{customerAnswers.name}</p>}
                  {customerAnswers.phone && <p className="text-sm">{customerAnswers.phone}</p>}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">Answers</h3>
                  {customerAnswers.questions?.length ? (
                    customerAnswers.questions.map((q: any) => (
                      <div key={q.id} className="mb-3">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{q.question}</div>
                        <div className="text-sm text-muted-foreground">{q.answered || '—'}</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-muted-foreground">No answers yet</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
