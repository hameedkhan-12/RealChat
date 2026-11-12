"use client"

import { onGetDomainMembers, onInviteAgent, onRemoveTeamMember } from '@/actions/settings'
import InfoBar from '@/components/infobar'
import React, { useEffect, useState } from 'react'

const TeamPage = async () => {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    onGetDomainMembers('current-domain')
      .then((res) => {
        if (res?.ok) setMembers((res.data as any).members || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setInviting(true)
    const res = await onInviteAgent('current-domain', inviteEmail)
    if (res?.ok) {
      setInviteEmail('')
      setMembers(prev => [...prev, { email: inviteEmail, role: 'AGENT', status: 'invited' }])
    }
    setInviting(false)
  }

  const onRemove = async (id: string) => {
    setRemoving(id)
    const res = await onRemoveTeamMember('current-domain', id)
    if (res?.ok) {
      setMembers(prev => prev.filter(m => m.id !== id))
    }
    setRemoving(null)
  }

  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold">Team</h1>
            <p className="text-sm text-muted-foreground">Manage agents who can take over conversations</p>
          </div>
          <form onSubmit={onInvite} className="flex gap-2 mb-6 max-w-md">
            <input
              type="email"
              placeholder="agent@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-3 py-2 rounded border focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={inviting}
            />
            <button
              type="submit"
              disabled={inviting || !inviteEmail}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Invite
            </button>
          </form>
          <div className="border border-muted rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-sm font-medium text-muted-foreground">Email</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Role</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-3 text-muted-foreground text-center">No team members yet</td>
                  </tr>
                ) : (
                  members.map((m: any) => (
                    <tr key={m.id || m.email} className="border-b hover:bg-muted/50">
                      <td className="p-3 text-sm">{m.email}</td>
                      <td className="p-3 text-sm">{m.role}</td>
                      <td className="p-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          m.status === 'invited' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>{m.status || 'active'}</span>
                      </td>
                      <td className="p-3 text-right">
                        {m.status !== 'invited' && (
                          <button
                            onClick={() => onRemove(m.id)}
                            disabled={removing === m.id}
                            className="px-3 py-1.5 text-xs border rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {inviting && <p className="mt-4 text-sm text-muted-foreground">Inviting...</p>}
        </div>
      </div>
    </>
  )
}

export default TeamPage
