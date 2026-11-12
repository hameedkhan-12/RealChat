"use client"

import { onGetAvailability, onSetAvailabilityRule, onDeleteAvailabilityRule, onSetAvailabilityException } from '@/actions/settings'
import InfoBar from '@/components/infobar'
import React, { useEffect, useState } from 'react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const AvailabilityPage = async () => {
  const [rules, setRules] = useState<any[]>([])
  const [exceptions, setExceptions] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    onGetAvailability('current-domain')
      .then((res) => {
        if (res?.ok) {
          setRules((res.data as any).rules || [])
          setExceptions((res.data as any).exceptions || [])
          setSettings((res.data as any).settings || {})
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const minuteToTime = (m: number) => {
    const h = Math.floor(m / 60)
    const min = m % 60
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }

  const onSetRule = async (weekday: number, start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const res = await onSetAvailabilityRule('current-domain', weekday, sh * 60 + sm, eh * 60 + em)
    if (res?.ok) {
      setRules(prev => {
        const idx = prev.findIndex(r => r.weekday === weekday)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], startMinute: sh * 60 + sm, endMinute: eh * 60 + em }
          return next
        }
        return [...prev, { domainId: 'current-domain', weekday, startMinute: sh * 60 + sm, endMinute: eh * 60 + em }]
      })
    }
  }

  const onDeleteRule = async (weekday: number) => {
    const res = await onDeleteAvailabilityRule('current-domain', weekday)
    if (res?.ok) {
      setRules(prev => prev.filter(r => r.weekday !== weekday))
    }
  }

  const onToggleException = async (id: string, date: string, closed: boolean) => {
    const res = await onSetAvailabilityException('current-domain', date, !closed)
    if (res?.ok) {
      setExceptions(prev => prev.map(e => e.id === id ? { ...e, closed: !closed } : e))
    }
  }

  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold">Availability</h1>
            <p className="text-sm text-muted-foreground">Set when your bot is available to chat</p>
          </div>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl border bg-muted/50">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">Slot Duration</h3>
                  <p className="text-sm">{settings?.slotMinutes ?? 30} minutes</p>
                </div>
                <div className="p-4 rounded-xl border bg-muted/50">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">Buffer Between Slots</h3>
                  <p className="text-sm">{settings?.bufferMinutes ?? 0} minutes</p>
                </div>
                <div className="p-4 rounded-xl border bg-muted/50">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">Min Notice</h3>
                  <p className="text-sm">{settings?.minNoticeHours ?? 2} hours</p>
                </div>
              </div>
              <div className="mb-6">
                <h2 className="text-sm font-bold mb-3">Weekly Availability</h2>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((day, i) => {
                    const rule = rules.find((r: any) => r.weekday === i)
                    return (
                      <div key={i} className="flex flex-col gap-2 p-3 rounded-lg border">
                        <span className="text-xs font-bold text-muted-foreground">{day}</span>
                        <div className="flex gap-2">
                          <input
                            type="time"
                            value={rule ? minuteToTime(rule.startMinute) : ''}
                            onChange={(e) => onSetRule(i, e.target.value, rule ? minuteToTime(rule.endMinute) : '09:00')}
                            className="w-full px-2 py-1.5 rounded border text-sm"
                          />
                          <input
                            type="time"
                            value={rule ? minuteToTime(rule.endMinute) : ''}
                            onChange={(e) => onSetRule(i, rule ? minuteToTime(rule.startMinute) : '09:00', e.target.value)}
                            className="w-full px-2 py-1.5 rounded border text-sm"
                          />
                          {rule && (
                            <button
                              onClick={() => onDeleteRule(i)}
                              className="w-8 h-8 rounded bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        {!rule && <span className="text-[10px] text-muted-foreground">Not set</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="mb-6">
                <h2 className="text-sm font-bold mb-3">Date Exceptions</h2>
                <div className="space-y-2">
                  {exceptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No date exceptions configured.</p>
                  ) : (
                    exceptions.map((e: any) => (
                      <div key={e.id} className="flex items-center justify-between p-2 rounded border">
                        <span className="text-sm">{new Date(e.date).toLocaleDateString()}</span>
                        <button
                          onClick={() => onToggleException(e.id, e.date, e.closed)}
                          className={`px-2 py-1 rounded text-xs ${e.closed ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
                        >
                          {e.closed ? 'Closed' : 'Open'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default AvailabilityPage
