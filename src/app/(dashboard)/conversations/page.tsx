"use client"

import { onGetAllAccountDomains } from '@/actions/settings'
import { onGetDomainChatRooms, onGetCustomerAnswers } from '@/actions/conversation'
import InfoBar from '@/components/infobar'
import { Separator } from '@/components/ui/separator'
import React, { useEffect, useState } from 'react'

type ChatRoomItem = {
  id: string
  status: 'BOT' | 'WAITING_AGENT' | 'LIVE' | 'CLOSED'
  createdAt: Date
  lastActivityAt: Date
  consentAt: Date | null
  assignedToUserId: string | null
  assignedTo: string | undefined
  message: { message: string; createdAt: Date; seen: boolean }[]
}

type CustomerItem = {
  id: string
  email: string | null
  name: string | null
  phone: string | null
  chatRoom: ChatRoomItem[]
}

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

const ConversationsPage = async () => {
  const domains = await onGetAllAccountDomains()
  const [domainId, setDomainId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'WAITING_AGENT' | 'LIVE' | 'CLOSED' | 'BOT' | undefined>(undefined)
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [customerAnswers, setCustomerAnswers] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!domainId) return
    setLoading(true)
    onGetDomainChatRooms(domainId, filter)
      .then((data) => {
        if (data) setCustomers(data.customer)
      })
      .finally(() => setLoading(false))
  }, [domainId, filter])

  const onSelectRoom = (roomId: string, customerId: string | null) => {
    setSelectedRoom(roomId)
    if (customerId) {
      setLoading(true)
      import('@/actions/conversation').then(({ onGetCustomerAnswers }) =>
        onGetCustomerAnswers(customerId).then((res) => {
          if (res?.ok) setCustomerAnswers(res.data)
          setLoading(false)
        })
      )
    }
  }

  const onCloseRoom = async (roomId: string) => {
    const { onCloseConversation } = await import('@/actions/conversation')
    const res = await onCloseConversation(roomId)
    if (res?.ok) {
      setCustomers(prev =>
        prev.map(c => ({
          ...c,
          chatRoom: c.chatRoom.map(r => r.id === roomId ? { ...r, status: 'CLOSED' } : r),
        }))
      )
      if (selectedRoom === roomId) setSelectedRoom(null)
    }
  }

  const onReturnRoomToBot = async (roomId: string) => {
    const { onReturnToBot } = await import('@/actions/conversation')
    const res = await onReturnToBot(roomId)
    if (res?.ok) {
      setCustomers(prev =>
        prev.map(c => ({
          ...c,
          chatRoom: c.chatRoom.map(r => r.id === roomId ? { ...r, status: 'BOT', assignedToUserId: null } : r),
        }))
      )
    }
  }

  const rooms = customers.flatMap(c =>
    c.chatRoom.map(r => ({ ...r, customerEmail: c.email, customerName: c.name, customerPhone: c.phone, customerId: c.id }))
  )

  const waitingCount = rooms.filter(r => r.status === 'WAITING_AGENT').length
  const liveCount = rooms.filter(r => r.status === 'LIVE').length

  return (
    <div className="w-full h-full flex flex-col">
      <InfoBar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Domain + filter bar */}
        <div className="px-4 py-3 border-b flex items-center gap-4 bg-muted/50">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Domain:</span>
            <select
              value={domainId ?? ''}
              onChange={(e) => setDomainId(e.target.value || null)}
              className="border rounded px-2 py-1.5 text-sm"
            >
              <option value="">All domains</option>
              {domains?.domains?.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-medium text-muted-foreground">Status filter:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setFilter(undefined)}
                className={`px-2 py-1 rounded text-sm border ${!filter ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'border-transparent'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('WAITING_AGENT')}
                className={`px-2 py-1 rounded text-sm border ${filter === 'WAITING_AGENT' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : 'border-transparent'}`}
              >
                Waiting ({waitingCount})
              </button>
              <button
                onClick={() => setFilter('LIVE')}
                className={`px-2 py-1 rounded text-sm border ${filter === 'LIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'border-transparent'}`}
              >
                Live ({liveCount})
              </button>
              <button
                onClick={() => setFilter('CLOSED')}
                className={`px-2 py-1 rounded text-sm border ${filter === 'CLOSED' ? 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300' : 'border-transparent'}`}
              >
                Closed
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: conversation list */}
          <div className="w-[400px] border-r border-border flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-bold">Conversations</h2>
              <span className="text-xs font-medium text-muted-foreground">{rooms.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {rooms.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No conversations
                </div>
              ) : (
                rooms.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onSelectRoom(r.id, r.customerId)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${selectedRoom === r.id ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' : 'border-transparent hover:bg-muted/50'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase ${STATUS_COLORS[r.status]}`}>
                          {STATUS_LABELS[r.status]}
                        </span>
                        {r.assignedToUserId && (
                          <span className="text-[10px] text-muted-foreground">• {r.assignedTo}</span>
                        )}
                      </div>
                      <div className="text-sm font-medium truncate">{r.customerName || r.customerEmail || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.message?.[0]?.message || 'No messages'}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {new Date(r.lastActivityAt || r.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      {r.status === 'WAITING_AGENT' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onReturnRoomToBot(r.id) }}
                          className="p-1.5 text-xs text-green-600 hover:bg-green-50 rounded"
                          title="Return to bot"
                        >
                          ↩
                        </button>
                      )}
                      {r.status === 'LIVE' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onCloseRoom(r.id) }}
                          className="p-1.5 text-xs text-red-600 hover:bg-red-50 rounded"
                          title="Close"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: conversation view */}
          <Separator orientation="vertical" className="h-full" />
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedRoom ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <h2 className="text-lg font-medium mb-2">Select a conversation</h2>
                <p className="text-sm">Pick a conversation from the list to view transcript and respond.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold">
                      {selectedRoom && rooms.find(r => r.id === selectedRoom)?.customerName || 'Conversation'}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedRoom && rooms.find(r => r.id === selectedRoom)?.customerEmail || ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onReturnRoomToBot(selectedRoom!)}
                      className="px-3 py-1.5 text-xs border rounded bg-amber-50 text-amber-700 hover:bg-amber-100"
                      disabled={!rooms.find(r => r.id === selectedRoom) || rooms.find(r => r.id === selectedRoom)!.status !== 'LIVE'}
                    >
                      Return to Bot
                    </button>
                    <button
                      onClick={() => onCloseRoom(selectedRoom!)}
                      className="px-3 py-1.5 text-xs border rounded bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedRoom && rooms.find(r => r.id === selectedRoom)?.message.map((m: any) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-lg ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                        {m.message}
                        <div className="text-[10px] text-muted-foreground mt-1 text-right">
                          {new Date(m.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t">
                  <form className="flex gap-2">
                    <input
                      className="flex-1 px-3 py-2 rounded border focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Type your reply..."
                    />
                    <button
                      className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      disabled={loading}
                    >
                      Send
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar: customer answers */}
          {customerAnswers && (
            <div className="w-[320px] border-l border-border bg-muted/50 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h2 className="text-sm font-bold">Lead Details</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">Contact</h3>
                  <p className="text-sm">{customerAnswers.email}</p>
                  {customerAnswers.name && <p className="text-sm">{customerAnswers.name}</p>}
                  {customerAnswers.phone && <p className="text-sm">{customerAnswers.phone}</p>}
                  {customerAnswers.consentAt && (
                    <p className="text-[10px] text-muted-foreground">Consent: {new Date(customerAnswers.consentAt).toLocaleString()}</p>
                  )}
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
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">Rooms</h3>
                  {customerAnswers.chatRooms?.map((r: any) => (
                    <div key={r.id} className="text-[10px]">
                      {r.status} - {new Date(r.createdAt).toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConversationsPage
