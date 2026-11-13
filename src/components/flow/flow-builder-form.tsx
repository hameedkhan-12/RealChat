'use client'

import { onGetFlowSteps, onUpsertFlowStep, onDeleteFlowStep } from '@/actions/settings'
import React, { useEffect, useState } from 'react'

const TYPE_LABELS: Record<string, string> = {
  CHOICE: 'Choice',
  MULTI_CHOICE: 'Multi Choice',
  TEXT: 'Text',
  NUMBER: 'Number',
  EMAIL: 'Email',
  PHONE: 'Phone',
}

const MAPS_TO_LABELS: Record<string, string> = {
  NONE: 'None',
  NAME: 'Name',
  EMAIL: 'Email',
  PHONE: 'Phone',
}

type Props = {
  domainId: string
}

export function FlowBuilderForm({ domainId }: Props) {
  const [steps, setSteps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<{
    key: string; type: string; prompt: string; options: string; position: number; required: boolean; mapsTo: string; isActive: boolean
  }>({
    key: '', type: 'CHOICE', prompt: '', options: '', position: 1, required: true, mapsTo: 'NONE', isActive: true
  })

  useEffect(() => {
    if (!domainId) {
      setLoading(false)
      return
    }
    setLoading(true)
    onGetFlowSteps(domainId)
      .then((res) => {
        if (res?.ok) setSteps((res.data as any).steps || [])
      })
      .finally(() => setLoading(false))
  }, [domainId])

  const onAdd = () => setForm({ key: '', type: 'CHOICE', prompt: '', options: '', position: 1, required: true, mapsTo: 'NONE', isActive: true })

  const onEdit = (step: any) => {
    setForm({
      key: step.key, type: step.type, prompt: step.prompt,
      options: Array.isArray(step.options) ? JSON.stringify(step.options, null, 2) : '',
      position: step.position, required: step.required, mapsTo: step.mapsTo, isActive: step.isActive
    })
    setEditing(step)
  }

  const onSave = async () => {
    let options: any = null
    if (form.options.trim()) {
      try { options = JSON.parse(form.options) } catch { /* keep null */ }
    }
    const res = await onUpsertFlowStep(
      domainId, editing?.id || null,
      form.position, form.key, form.type, form.prompt,
      options, form.required, form.mapsTo, form.isActive
    )
    if (res?.ok) {
      setEditing(null)
      setForm({ key: '', type: 'CHOICE', prompt: '', options: '', position: 1, required: true, mapsTo: 'NONE', isActive: true })
      onGetFlowSteps(domainId).then((r) => {
        if (r?.ok) setSteps((r.data as any).steps || [])
      })
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm('Delete this flow step?')) return
    const res = await onDeleteFlowStep(domainId, id)
    if (res?.ok) {
      setSteps(prev => prev.filter(s => s.id !== id))
    }
  }

  if (!domainId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <h2 className="text-lg font-medium mb-2">Select a domain</h2>
        <p className="text-sm">Open a domain from the sidebar to manage its flow.</p>
      </div>
    )
  }

  return (
    <>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Flow Builder</h1>
          <p className="text-sm text-muted-foreground">Build your chatbot conversation flow</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Steps list */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-bold mb-4">Flow Steps</h2>
            <div className="space-y-2">
              {steps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No flow steps yet. Add one below.</p>
              ) : (
                steps.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">#{s.position}</span>
                        <span className="text-xs font-medium">{TYPE_LABELS[s.type] || s.type}</span>
                        {s.mapsTo !== 'NONE' && (
                          <span className="text-[10px] text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded">
                            maps to {s.mapsTo}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium truncate">{s.prompt}</div>
                      <div className="text-[10px] text-muted-foreground">{s.key}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onEdit(s)}
                        className="p-2 text-xs text-blue-600 hover:bg-blue-50 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(s.id)}
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
            <h2 className="text-sm font-bold mb-4">{editing ? 'Edit Step' : 'Add Step'}</h2>
            <div className="p-4 rounded-xl border bg-muted/50 space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted-foreground">Key (slug)</label>
                <input
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  className="w-full px-2 py-1 rounded border text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted-foreground">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-2 py-1 rounded border text-sm"
                >
                  {['CHOICE', 'MULTI_CHOICE', 'TEXT', 'NUMBER', 'EMAIL', 'PHONE'].map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted-foreground">Prompt</label>
                <textarea
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                  rows={2}
                  className="w-full px-2 py-1 rounded border text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted-foreground">Options JSON</label>
                <textarea
                  value={form.options}
                  onChange={(e) => setForm({ ...form, options: e.target.value })}
                  rows={3}
                  className="w-full px-2 py-1 rounded border font-mono text-xs"
                  placeholder='[{"label":"Buy","value":"buy","nextStepKey":"property_type"}]'
                />
                </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted-foreground">Maps To</label>
                <select
                  value={form.mapsTo}
                  onChange={(e) => setForm({ ...form, mapsTo: e.target.value })}
                  className="w-full px-2 py-1 rounded border text-sm"
                >
                  {['NONE', 'NAME', 'EMAIL', 'PHONE'].map((m) => (
                    <option key={m} value={m}>{MAPS_TO_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-muted-foreground">Required</label>
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) => setForm({ ...form, required: e.target.checked })}
                  className="rounded border text-blue-600"
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
                  disabled={!form.key || !form.prompt}
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
      </div>
    </>
  )
}
