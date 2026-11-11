import React from 'react'
import { cn, extractUUIDFromString, getMonthName } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { User } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { ChatMessageType } from '@/schemas/conversation.schema'
import { SlotPicker } from './slot-picker'
import { ChatEndedCard, MeetingBookedCard } from './meeting-card'

type Props = {
  message: ChatMessageType
  createdAt?: Date
  botIcon?: string | null
  theme?: string | null
  textColor?: string | null
  brandName?: string
  isLatest?: boolean
  onSelectOption?: (option: string) => void
  onBookSlot?: (dateStr: string, slotTime: string) => void
  onRestartChat?: () => void
}

const Bubble = ({
  message,
  createdAt,
  botIcon,
  theme,
  textColor,
  brandName = 'J7 Group',
  isLatest = true,
  onSelectOption,
  onBookSlot,
  onRestartChat,
}: Props) => {
  let d = new Date()
  const image = extractUUIDFromString(message.content || '')

  // Render Meeting Booked confirmation card
  if (message.widget === 'meeting-booked') {
    return (
      <div className="w-full flex flex-col items-center">
        <MeetingBookedCard
          brandName={message.widgetData?.brandName || brandName}
          botIcon={botIcon}
          dateStr={message.widgetData?.date}
          slot={message.widgetData?.slot}
          timezone={message.widgetData?.timezone}
          duration={message.widgetData?.duration}
        />
      </div>
    )
  }

  // Render Chat Ended card
  if (message.widget === 'chat-ended') {
    return (
      <div className="w-full flex flex-col items-center">
        <ChatEndedCard onRestartChat={onRestartChat || (() => {})} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full animate-in fade-in duration-200">
      <div
        className={cn(
          'flex gap-2.5 items-end',
          message.role == 'assistant'
            ? 'self-start'
            : 'self-end flex-row-reverse'
        )}
      >
        {/* Avatar */}
        {message.role == 'assistant' ? (
          <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 flex items-center justify-center overflow-hidden shrink-0 mb-0.5 shadow-2xs">
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
              <span className="font-bold text-[10px] uppercase text-neutral-800 dark:text-neutral-200">
                {brandName.slice(0, 2)}
              </span>
            )}
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0 mb-0.5">
            <User className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
          </div>
        )}

        {/* Message Bubble */}
        <div
          style={{
            backgroundColor:
              message.role === 'user' && theme ? theme : undefined,
            color:
              message.role === 'user' && textColor ? textColor : undefined,
          }}
          className={cn(
            'flex flex-col gap-1.5 min-w-[120px] max-w-[320px] px-4 py-3 text-[13.5px] leading-relaxed transition-all',
            message.role == 'assistant'
              ? 'bg-[#EFF2F6] dark:bg-[#1E1E22] text-[#18181B] dark:text-[#F3F4F6] rounded-2xl rounded-bl-xs border border-neutral-200/40 dark:border-neutral-800/60 shadow-2xs'
              : !theme &&
                  'bg-[#18181B] text-white dark:bg-white dark:text-[#18181B] rounded-2xl rounded-br-xs shadow-2xs font-medium'
          )}
        >
          {image ? (
            <div className="relative aspect-square rounded-xl overflow-hidden my-1">
              <Image
                src={`https://ucarecdn.com/${image[0]}/`}
                fill
                alt="image"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="whitespace-pre-wrap">
              {message.content.replace('(complete)', '')}
              {message.link && (
                <Link
                  className="underline font-semibold pl-1.5 text-primary inline-block hover:opacity-80"
                  href={message.link}
                  target="_blank"
                >
                  View Details →
                </Link>
              )}
            </div>
          )}

          {createdAt ? (
            <div className="flex gap-2 text-[10px] text-muted-foreground opacity-60 self-end">
              <p>
                {createdAt.getHours()}:{String(createdAt.getMinutes()).padStart(2, '0')}
                {createdAt.getHours() >= 12 ? ' PM' : ' AM'}
              </p>
            </div>
          ) : (
            <p className="text-[10px] opacity-60 self-end">
              {`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} ${
                d.getHours() >= 12 ? 'PM' : 'AM'
              }`}
            </p>
          )}
        </div>
      </div>

      {message.role === 'assistant' &&
        message.options &&
        message.options.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-0.5 ml-9 max-w-[340px] animate-in fade-in-50 duration-200">
            {message.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectOption && onSelectOption(opt)}
                className="px-3.5 py-2 text-[12.5px] font-medium rounded-xl border border-neutral-200/90 dark:border-neutral-700 bg-white dark:bg-[#18181B] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-500 shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                {opt}
              </button>
            ))}
          </div>
        )}

      {/* In-Widget Slot Selector (Matches image 3 & 4) */}
      {message.role === 'assistant' && message.widget === 'slot-picker' && (
        <div className="ml-9 mt-1 max-w-[360px]">
          <SlotPicker
            onSelectSlot={(dateStr, slotTime) =>
              onBookSlot && onBookSlot(dateStr, slotTime)
            }
          />
        </div>
      )}
    </div>
  )
}

export default Bubble
