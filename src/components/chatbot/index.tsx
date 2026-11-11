'use client'
import { useChatBot } from '@/hooks/chatbot/use-chatbot'
import React from 'react'
import { BotWindow } from './window'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { BotIcon } from '@/icons/bot-icon'

type Props = {}

const AiChatBot = (props: Props) => {
  const {
    onOpenChatBot,
    botOpened,
    onChats,
    register,
    onStartChatting,
    onSelectOption,
    onBookSlot,
    onRestartChat,
    onAiTyping,
    messageWindowRef,
    currentBot,
    loading,
    onRealTime,
    setOnChats,
    errors,
  } = useChatBot()

  const clientIcon = currentBot?.chatBot?.icon || (currentBot as any)?.icon

  return (
    <div className="flex flex-col justify-end items-end gap-2 p-3" style={{ background: 'transparent' }}>
      {botOpened && (
        <BotWindow
          errors={errors}
          setChat={setOnChats}
          realtimeMode={onRealTime}
          helpdesk={currentBot?.helpdesk!}
          domainName={currentBot?.name!}
          ref={messageWindowRef}
          help={currentBot?.chatBot?.helpdesk}
          theme={currentBot?.chatBot?.background}
          textColor={currentBot?.chatBot?.textColor}
          botIcon={clientIcon}
          chats={onChats}
          register={register}
          onChat={onStartChatting}
          onResponding={onAiTyping}
          onSelectOption={onSelectOption}
          onBookSlot={onBookSlot}
          onRestartChat={onRestartChat}
          onClose={onOpenChatBot}
        />
      )}
      <div
        style={{
          backgroundColor: currentBot?.chatBot?.background || '#FFFFFF',
          color: currentBot?.chatBot?.textColor || '#000000',
          display: loading ? 'none' : 'flex',
        }}
        className={cn(
          'rounded-full relative cursor-pointer shadow-xl w-[58px] h-[58px] items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 border border-neutral-200/90 text-black',
          botOpened && 'hidden'
        )}
        onClick={onOpenChatBot}
      >
        {clientIcon ? (
          <div className="relative w-full h-full rounded-full overflow-hidden">
            <Image
              src={
                clientIcon.startsWith('http')
                  ? clientIcon
                  : `https://ucarecdn.com/${clientIcon}/`
              }
              alt="bot icon"
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </div>
    </div>
  )
}

export default AiChatBot
