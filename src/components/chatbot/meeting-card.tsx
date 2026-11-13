'use client'
import React from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Calendar, Clock, RotateCcw } from 'lucide-react'

type MeetingBookedProps = {
  brandName?: string
  botIcon?: string | null
  dateStr?: string
  slot?: string
  timezone?: string
  duration?: string
}

export const MeetingBookedCard = ({
  brandName = 'RealChat',
  botIcon,    
  dateStr,
  slot,
  timezone = '(GMT+05:00) Asia/Karachi',
  duration = '15 min',
}: MeetingBookedProps) => {
  return (
    <Card className="w-full bg-[#EFF3F8] dark:bg-[#1A1D24] border border-neutral-200/60 dark:border-neutral-800 rounded-2xl p-5 shadow-2xs text-center my-2 animate-in zoom-in-95 duration-200">
      <div className="flex flex-col items-center gap-2.5">
        {/* Round Logo */}
        <div className="w-12 h-12 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center overflow-hidden shadow-xs">
          {botIcon ? (
            <img
              src={
                botIcon.startsWith('http')
                  ? botIcon
                  : `https://ucarecdn.com/${botIcon}/`
              }
              alt={brandName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-bold text-sm uppercase text-neutral-800 dark:text-neutral-200">
              {brandName.slice(0, 2)}
            </span>
          )}
        </div>

        <h3 className="font-bold text-[14px] text-neutral-900 dark:text-neutral-100 tracking-tight">
          Intro call with {brandName}...
        </h3>

        <div className="flex flex-col items-center gap-1 text-[12px] text-neutral-600 dark:text-neutral-400">
          <div className="flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-neutral-500" />
            <span>{duration}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
            <span className="font-medium text-neutral-900 dark:text-neutral-200">
              {dateStr ? `${dateStr} ${slot || ''}` : slot}
            </span>
          </div>

          <p className="text-[11px] text-neutral-400">{timezone}</p>
        </div>

        {/* Green MEETING BOOKED badge matching Screenshot 5 */}
        <div className="mt-2">
          <span className="text-[#10B981] font-extrabold text-[12px] tracking-wider uppercase">
            MEETING BOOKED
          </span>
        </div>
      </div>
    </Card>
  )
}

type ChatEndedProps = {
  onRestartChat: () => void
}

export const ChatEndedCard = ({ onRestartChat }: ChatEndedProps) => {
  return (
    <Card className="w-full bg-[#F9FAFB] dark:bg-[#18181B] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-5 shadow-2xs text-center my-2 flex flex-col items-center gap-2.5 animate-in fade-in-50 duration-200">
      <p className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
        This chat has ended!
      </p>
      <Button
        onClick={onRestartChat}
        className="bg-[#18181B] hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-xs font-semibold rounded-xl px-4 py-2 flex items-center gap-2 shadow-xs transition-transform active:scale-95"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Start a new chat
      </Button>
    </Card>
  )
}
