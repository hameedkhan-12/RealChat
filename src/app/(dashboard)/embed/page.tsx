"use client"

import { onGetEmbedConfig, onUpdateDomainSettings } from '@/actions/settings'
import InfoBar from '@/components/infobar'
import React, { useEffect, useState } from 'react'

const EmbedPage = async () => {
  const [config, setConfig] = useState<any>(null)
  const [allowedOrigins, setAllowedOrigins] = useState<string>('')
  const [timezone, setTimezone] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    onGetEmbedConfig('current-domain')
      .then((res) => {
        if (res?.ok) {
          setConfig((res.data as any))
          setAllowedOrigins(((res.data as any).allowedOrigins || []).join('\n'))
          setTimezone((res.data as any).timezone || 'UTC')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const onSaveSettings = async () => {
    setSaving(true)
    const origins = allowedOrigins.split('\n').map(o => o.trim()).filter(Boolean)
    const res = await onUpdateDomainSettings('current-domain', origins, timezone)
    if (res?.ok) {
      setConfig((prev: any) => ({ ...prev, allowedOrigins: origins }))
      alert('Settings saved')
    }
    setSaving(false)
  }

  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold">Embed</h1>
            <p className="text-sm text-muted-foreground">Embed your chatbot widget on any website</p>
          </div>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-sm font-bold mb-3">Embed Code</h2>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={config?.embedScript || ''}
                    className="flex-1 px-3 py-2 rounded border bg-muted font-mono text-xs"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(config?.embedScript || '')
                    }}
                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Paste this script on your website where you want the chat widget to appear.
                </p>
              </div>
              <div className="mb-6">
                <h2 className="text-sm font-bold mb-3">Embed Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Allowed Origins (one per line)</label>
                    <textarea
                      value={allowedOrigins}
                      onChange={(e) => setAllowedOrigins(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 rounded border font-mono text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Comma-separated or one per line. Leave empty to allow all origins.</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Timezone</label>
                    <input
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-3 py-2 rounded border"
                    />
                  </div>
                  <button
                    onClick={onSaveSettings}
                    disabled={saving}
                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
              <div className="mb-6">
                <h2 className="text-sm font-bold mb-3">Direct Link</h2>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={config?.chatbotUrl || ''}
                    className="flex-1 px-3 py-2 rounded border bg-muted font-mono text-xs"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(config?.chatbotUrl || '')
                    }}
                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default EmbedPage
