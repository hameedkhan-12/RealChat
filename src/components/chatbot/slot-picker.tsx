'use client'
import React, { useState } from 'react'
import { Card } from '../ui/card'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  onSelectSlot: (dateStr: string, slotTime: string) => void
  disabled?: boolean
  onBack?: () => void
}

type DaySlot = {
  dateObj: Date
  dateString: string
  dayLabel: string
  available: boolean
  slots: string[]
}

export const SlotPicker = ({ onSelectSlot, disabled, onBack }: Props) => {
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({})
  const [selectedSlot, setSelectedSlot] = useState<{
    dateStr: string
    slot: string
  } | null>(null)

  const days: DaySlot[] = []
  const now = new Date()

  // Format timezone string (e.g. "15 min - (GMT +05:00) Asia/Karachi")
  let tzString = '15 min - (GMT +05:00) Asia/Karachi'
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const offsetMin = -now.getTimezoneOffset()
    const sign = offsetMin >= 0 ? '+' : '-'
    const hours = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0')
    const mins = String(Math.abs(offsetMin) % 60).padStart(2, '0')
    tzString = `15 min - (GMT ${sign}${hours}:${mins}) ${tz}`
  } catch {}

  const standardSlots = [
    '10:00 am',
    '10:15 am',
    '10:30 am',
    '10:45 am',
    '11:00 am',
    '11:15 am',
    '02:00 pm',
    '02:30 pm',
    '03:00 pm',
    '03:30 pm',
  ]

  for (let i = 0; i < 6; i++) {
    const d = new Date()
    d.setDate(now.getDate() + i)

    const dayOfWeek = d.getDay() // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }
    const dayLabel = d.toLocaleDateString('en-GB', options) // e.g. "Monday, 02 November 2026"
    const dateString = d.toISOString().split('T')[0] // YYYY-MM-DD

    // Weekends have no slots (matches Omniyat screenshot)
    const available = !isWeekend

    days.push({
      dateObj: d,
      dateString,
      dayLabel,
      available,
      slots: available ? standardSlots : [],
    })
  }

  const toggleExpand = (idx: number) => {
    setExpandedDays((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  const handlePick = (day: DaySlot, slot: string) => {
    if (disabled) return
    setSelectedSlot({ dateStr: day.dayLabel, slot })
    onSelectSlot(day.dayLabel, slot)
  }

  return (
    <Card className="w-full bg-white dark:bg-[#18181B] border border-neutral-200/90 dark:border-neutral-700/80 rounded-2xl p-4 shadow-sm text-foreground my-1.5 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
        <button
          type="button"
          onClick={onBack}
          className="text-neutral-500 hover:text-black dark:hover:text-white transition-colors p-0.5 rounded-full"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>
        <h4 className="font-semibold text-sm text-center flex-1 pr-5 text-neutral-900 dark:text-neutral-100">
          Select your slot
        </h4>
      </div>

      {/* Dates and slots list */}
      <div className="flex flex-col gap-3.5 max-h-[320px] overflow-y-auto pr-1 pt-3">
        {days.map((day, idx) => {
          const isExpanded = expandedDays[idx]
          const visibleSlots = isExpanded ? day.slots : day.slots.slice(0, 5)

          return (
            <div
              key={idx}
              className="flex flex-col gap-2 pb-3.5 border-b border-neutral-100 dark:border-neutral-800/80 last:border-b-0"
            >
              <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                {day.dayLabel}
              </p>

              {!day.available ? (
                <p className="text-[12px] text-neutral-400">
                  No slots available for this day
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 mt-0.5">
                  {visibleSlots.map((slot) => {
                    const isSelected =
                      selectedSlot?.dateStr === day.dayLabel &&
                      selectedSlot?.slot === slot

                    return (
                      <button
                        key={slot}
                        disabled={disabled}
                        onClick={() => handlePick(day, slot)}
                        className={cn(
                          'py-1.5 px-2 text-center text-xs rounded-xl border transition-all truncate',
                          isSelected
                            ? 'bg-black text-white dark:bg-white dark:text-black font-semibold border-black dark:border-white shadow-xs'
                            : 'bg-white dark:bg-neutral-800/80 border-neutral-200/90 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-black dark:hover:border-white hover:bg-neutral-50 dark:hover:bg-neutral-700'
                        )}
                      >
                        {slot}
                      </button>
                    )
                  })}

                  {day.slots.length > 5 && !isExpanded && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(idx)}
                      className="py-1.5 px-2 text-center text-xs rounded-xl border border-neutral-200/90 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-black dark:hover:border-white hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all font-medium"
                    >
                      Show more
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 text-center">
        <p className="text-[11px] text-neutral-400 font-medium">{tzString}</p>
      </div>
    </Card>
  )
}
