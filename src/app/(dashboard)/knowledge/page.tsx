'use client'

import { onGetKnowledgeItems, onUpsertKnowledgeItem, onDeleteKnowledgeItem } from '@/actions/knowledge'
import { onGetAllAccountDomains } from '@/actions/settings'
import InfoBar from '@/components/infobar'
import { useEffect, useState } from 'react'

type KnowledgeItem = {
  id: string
  title: string
  content: string
  category: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>
}) {
  const sp = await searchParams
  const domainId = typeof sp.domain === 'string' ? sp.domain : ''

  const [domains, setDomains] = useState<Array<{ id: string; name: string }>>([])
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<KnowledgeItem | null>(null)
  const [form, setForm] = useState<{ title: string; content: string; category: string; isActive: boolean }>({
    title: '', content: '', category: '', isActive: true
  })

  useEffect(() => {
    setLoading(true)
    onGetAllAccountDomains()
      .then((res: any) => {
        if (res?.ok) setDomains((res.data as any).domains || [])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!domainId) return
    setLoading(true)
    onGetKnowledgeItems(domainId)
      .then((res: any) => {
        if (res?.ok) setItems((res.data as any).items || [])
      })
      .finally(() => setLoading(false))
  }, [domainId])

  const onAdd = () => setForm({ title: '', content: '', category: '', isActive: true })

  const onEdit = (item: KnowledgeItem) => {
    setForm({ title: item.title, content: item.content, category: item.category ?? '', isActive: item.isActive })
    setEditing(item)
  }

  const onSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    const res = await onUpsertKnowledgeItem(domainId, editing?.id || null, {
      title: form.title,
      content: form.content,
      category: form.category || undefined,
      isActive: form.isActive,
    })
    if ((res as any)?.ok) {
      setEditing(null)
      setForm({ title: '', content: '', category: '', isActive: true })
      onGetKnowledgeItems(domainId)
        .then((r: any) => { if (r?.ok) setItems((r.data as any).items || []) })
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm('Delete this knowledge item?')) return
    const res = await onDeleteKnowledgeItem(domainId, id)
    if ((res as any)?.ok) {
      setItems(prev => prev.filter(i => i.id !== id))
    }
  }

  const toggleActive = async (item: KnowledgeItem) => {
    const res = await onUpsertKnowledgeItem(domainId, item.id, {
      title: item.title,
      content: item.content,
      category: item.category || undefined,
      isActive: !item.isActive,
    })
    if ((res as any)?.ok) {
      onGetKnowledgeItems(domainId)
        .then((r) => { if (r?.ok) setItems((r.data as any).items || []) })
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>

  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <div className="p-6">
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">Knowledge Base</h1>
              <p className="text-sm text-muted-foreground">FAQ and company facts the AI answers from.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                defaultValue={domainId}
                onChange={(e) => {
                  const id = (e.target as HTMLSelectElement).value
                  if (id) window.location.href = `?domain=${id}`
                }}
                className="border rounded px-2 py-1.5 text-sm"
              >
                <option value="">Select a website</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {!domainId && (
            <div className="text-center py-20 text-muted-foreground">
              <h2 className="text-lg font-medium mb-2">Select a website</h2>
              <p className="text-sm">Choose a domain from the dropdown to manage its knowledge base.</p>
            </div>
          )}

          {domainId && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Items list */}
              <div className="lg:col-span-2">
                <h2 className="text-sm font-bold mb-4">Knowledge Items</h2>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No knowledge items yet. Add one below.</p>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase ${item.isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {item.isActive ? 'Active' : 'Inactive'}
                            </span>
                            {item.category && (
                              <span className="text-[10px] text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded">
                                {item.category}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-medium truncate">{item.title}</div>
                          <div className="text-[10px] text-muted-foreground line-clamp-2">{item.content}</div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => onEdit(item)}
                            className="p-2 text-xs text-blue-600 hover:bg-blue-50 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleActive(item)}
                            className={`p-2 text-xs rounded ${item.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                          >
                            {item.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => onDelete(item.id)}
                            className="p-2 text-xs text-red-600 hover:bg-red-50 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {/* Editor */}
              <div className="lg:col-span-1">
                <h2 className="text-sm font-bold mb-4">{editing ? 'Edit Item' : 'Add Item'}</h2>
                <div className="p-4 rounded-xl border bg-muted/50 space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-muted-foreground">Title</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full px-2 py-1 rounded border text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-muted-foreground">Content</label>
                    <textarea
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      rows={4}
                      className="w-full px-2 py-1 rounded border text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-muted-foreground">Category</label>
                    <input
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-2 py-1 rounded border text-sm"
                      placeholder="e.g. Pricing, Locations, Process"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-muted-foreground">Active</label>
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="rounded border text-blue-600"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={onSave}
                      disabled={!form.title || !form.content}
                      className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {editing ? 'Update' : 'Add'}
                    </button>
                    {editing && (
                      <button
                        onClick={() => setEditing(null)}
                        className="px-4 py-2 rounded border hover:bg-muted"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
