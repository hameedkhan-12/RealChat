"use client"

import { onGetLeads, onDeleteLead, onExportLeadsCSV } from '@/actions/settings'
import InfoBar from '@/components/infobar'
import React, { useEffect, useState } from 'react'

const LeadsPage = async () => {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    onGetLeads('current-domain')
      .then((res) => {
        if (res?.ok) setLeads((res.data as any).leads || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const onDelete = async (id: string) => {
    setDeleting(id)
    const res = await onDeleteLead('current-domain', id)
    if (res?.ok) {
      setLeads(prev => prev.filter(l => l.id !== id))
    }
    setDeleting(null)
  }

  const onExport = async () => {
    const res = await onExportLeadsCSV('current-domain')
    if (res?.ok) {
      const csv = (res.data as any).csv
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (res.data as any).filename || 'leads.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold">Leads</h1>
              <p className="text-sm text-muted-foreground">All chatbot leads for your domain</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onExport}
                className="px-3 py-2 rounded border hover:bg-muted disabled:opacity-50"
                disabled={loading || leads.length === 0}
              >
                Export CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto border border-muted">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Email</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Phone</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Consent</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Created</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-3 text-muted-foreground text-center">No leads yet</td>
                  </tr>
                ) : (
                  leads.map((l: any) => (
                    <tr key={l.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 text-sm">{l.name || '—'}</td>
                      <td className="p-3 text-sm">{l.email || '—'}</td>
                      <td className="p-3 text-sm">{l.phone || '—'}</td>
                      <td className="p-3 text-sm">
                        {l.consentAt ? <span className="text-xs text-emerald-600">Yes</span> : <span className="text-xs text-muted-foreground">No</span>}
                      </td>
                      <td className="p-3 text-sm text-[11px]">{new Date(l.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => onDelete(l.id)}
                          disabled={deleting === l.id}
                          className="px-3 py-1.5 text-xs border rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {deleting === l.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

export default LeadsPage
