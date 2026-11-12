'use client'
import { useChatBot } from '@/hooks/chatbot/use-chatbot'
import React from 'react'
import { BotWindow } from './window'
import { cn } from '@/lib/utils'
import Image from 'next/image'

type Props = { publicKey?: string }

const AiChatBot = ({ publicKey }: Props) => {
  const {
    onOpenChatBot, botOpened, onChats, register, onSelectOption,
    onBookSlot, onRestartChat, onAiTyping, messageWindowRef, currentBot, loading,
    onRealTime, setOnChats, errors, config, sessionToken, chatRoomId, sendMessage, getValues,
  } = useChatBot(publicKey)

  const bot = currentBot as any
  const clientIcon = bot?.chatBot?.avatarUrl || bot?.chatBot?.icon || bot?.icon
  const theme = bot?.chatBot?.primaryColor || bot?.chatBot?.background || '#FFFFFF'
  const textColor = bot?.chatBot?.textColor || '#000000'

  return (
    <div className="flex flex-col justify-end items-end gap-2 p-3" style={{ background: 'transparent' }}>
      {botOpened && (
        <BotWindow
          errors={errors}
          setChat={setOnChats}
          realtimeMode={onRealTime}
          helpdesk={(bot?.helpdesk as any) || []}
          domainName={config?.domainName || bot?.name || 'Assistant'}
          ref={messageWindowRef}
          help={bot?.chatBot?.helpdesk}
          theme={config?.chatBot?.primaryColor || theme}
          textColor={config?.chatBot?.textColor || textColor}
          botIcon={config?.chatBot?.avatarUrl || clientIcon}
          chats={onChats}
          register={register}
          onChat={() => { sendMessage(getValues().content || '') }}
          onResponding={onAiTyping}
          onSelectOption={onSelectOption}
          onBookSlot={onBookSlot}
          onRestartChat={onRestartChat}
          onClose={onOpenChatBot}
        />
      )}
      <div
        style={{ backgroundColor: theme, color: textColor, display: loading ? 'none' : 'flex' }}
        className={cn('rounded-full relative cursor-pointer shadow-xl w-[58px] h-[58px] items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 border border-neutral-200/90', botOpened && 'hidden')}
        onClick={onOpenChatBot}
      >
        {clientIcon ? (
          <div className="relative w-full h-full rounded-full overflow-hidden">
            <Image src={clientIcon.startsWith('http') ? clientIcon : `https://ucarecdn.com/${clientIcon}/`} alt="bot icon" fill className="object-cover" />
          </div>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        )}
      </div>
    </div>
  )
}

export default AiChatBot
