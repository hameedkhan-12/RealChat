'use client'
import React, { useState } from 'react'
import { Card } from '../ui/card'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = { onSelectSlot: (dateStr: string, slotTime: string) => void; disabled?: boolean; onBack?: () => void }
type DaySlot = { dateObj: Date; dateString: string; dayLabel: string; available: boolean; slots: string[] }

export const SlotPicker = ({ onSelectSlot, disabled, onBack }: Props) => {
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({})
  const [selectedSlot, setSelectedSlot] = useState<{ dateStr: string; slot: string } | null>(null)
  const days: DaySlot[] = []
  const now = new Date()
  let tzString = '15 min'
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const offsetMin = -now.getTimezoneOffset()
    const sign = offsetMin >= 0 ? '+' : '-'
    const hours = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0')
    const mins = String(Math.abs(offsetMin) % 60).padStart(2, '0')
    tzString = `15 min - (GMT ${sign}${hours}:${mins}) ${tz}`
  } catch {}
  const standardSlots = ['10:00 am','10:30 am','11:00 am','11:30 am','02:00 pm','02:30 pm','03:00 pm','03:30 pm']

  for (let i = 0; i < 6; i++) {
    const d = new Date(); d.setDate(now.getDate() + i)
    const dayOfWeek = d.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    days.push({ dateObj: d, dateString: d.toISOString().split('T')[0], dayLabel, available: !isWeekend, slots: !isWeekend ? standardSlots : [] })
  }

  const handlePick = (day: DaySlot, slot: string) => {
    if (disabled) return
    setSelectedSlot({ dateStr: day.dayLabel, slot })
    onSelectSlot(day.dayLabel, slot)
  }

  return (
    <Card className="w-full bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-sm text-foreground my-1.5">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
        <button type="button" onClick={onBack} className="text-neutral-500 hover:text-black transition-colors p-0.5 rounded-full"><ChevronLeft className="w-5 h-5 stroke-[2.5]" /></button>
        <h4 className="font-semibold text-sm text-center flex-1 pr-5 text-neutral-900">Select your slot</h4>
      </div>
      <div className="flex flex-col gap-3.5 max-h-[320px] overflow-y-auto pr-1 pt-3">
        {days.map((day, idx) => {
          const isExpanded = expandedDays[idx]
          const visibleSlots = isExpanded ? day.slots : day.slots.slice(0, 5)
          return (
            <div key={idx} className="flex flex-col gap-2 pb-3.5 border-b border-neutral-100 last:border-b-0">
              <p className="text-xs font-bold text-neutral-900 tracking-tight">{day.dayLabel}</p>
              {!day.available ? <p className="text-[12px] text-neutral-400">No slots available for this day</p> : (
                <div className="grid grid-cols-3 gap-2 mt-0.5">
                  {visibleSlots.map((slot) => {
                    const isSelected = selectedSlot?.dateStr === day.dayLabel && selectedSlot?.slot === slot
                    return <button key={slot} disabled={disabled} onClick={() => handlePick(day, slot)} className={cn('py-1.5 px-2 text-center text-xs rounded-xl border transition-all truncate', isSelected ? 'bg-black text-white font-semibold border-black shadow-xs' : 'bg-white border-neutral-200/90 text-neutral-700 hover:border-black hover:bg-neutral-50')}>{slot}</button>
                  })}
                  {day.slots.length > 5 && !isExpanded && <button type="button" onClick={() => setExpandedDays((p) => ({ ...p, [idx]: true }))} className="py-1.5 px-2 text-center text-xs rounded-xl border border-neutral-200/90 text-neutral-600 hover:border-black hover:bg-neutral-50 transition-all font-medium">Show more</button>}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-3 pt-2.5 border-t border-neutral-100 text-center"><p className="text-[11px] text-neutral-400 font-medium">{tzString}</p></div>
    </Card>
  )
}