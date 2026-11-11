'use client'
import { ChatBotMessageProps, ChatMessageType } from '@/schemas/conversation.schema'
import React, { forwardRef, useState } from 'react'
import { UseFormRegister } from 'react-hook-form'
import RealTimeMode from './real-time'
import Bubble from './bubble'
import { Responding } from './responding'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { ChevronDown, ChevronLeft, Maximize2, Paperclip, Send, X, HelpCircle, MessageSquare } from 'lucide-react'
import { Label } from '../ui/label'
import Accordion from '../accordian'

type Props = {
  errors: any
  register: UseFormRegister<ChatBotMessageProps>
  chats: ChatMessageType[]
  onChat(): void
  onResponding: boolean
  domainName: string
  theme?: string | null
  textColor?: string | null
  botIcon?: string | null
  help?: boolean
  realtimeMode: { chatroom: string; mode: boolean } | undefined
  helpdesk: { id: string; question: string; answer: string; domainId?: string | null }[]
  setChat: React.Dispatch<React.SetStateAction<ChatMessageType[]>>
  onSelectOption?: (option: string) => void
  onBookSlot?: (dateStr: string, slotTime: string) => void
  onRestartChat?: () => void
  onClose?: () => void
}

export const BotWindow = forwardRef<HTMLDivElement, Props>(
  ({ errors, register, chats, onChat, onResponding, domainName, helpdesk, realtimeMode, setChat, textColor, theme, botIcon, onSelectOption, onBookSlot, onRestartChat, onClose }, ref) => {
    const [activeTab, setActiveTab] = useState<'chat' | 'helpdesk'>('chat')
    const [isExpanded, setIsExpanded] = useState(false)
    const displayBotName = domainName || 'Assistant'
    const activeTheme = theme || '#FFFFFF'
    const activeTextColor = textColor || '#000000'

    const scrollToBottom = () => {
      if (ref && 'current' in ref && ref.current) {
        ref.current.scroll({ top: ref.current.scrollHeight, left: 0, behavior: 'smooth' })
      }
    }

    return (
      <div className={`flex flex-col bg-white rounded-2xl border border-neutral-200/90 shadow-2xl overflow-hidden relative transition-all duration-300 ease-in-out font-sans ${isExpanded ? 'h-[660px] w-[460px] max-w-[96vw]' : 'h-[580px] w-[375px] max-w-[94vw]'}`}>
        <div style={{ backgroundColor: activeTheme, color: activeTextColor }} className="flex justify-between px-3.5 py-3 items-center border-b border-neutral-200/80 z-20 select-none shadow-2xs">
          <div className="flex items-center gap-2.5">
            {onClose && <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100 transition-opacity p-0.5 rounded-full" title="Close"><ChevronLeft className="w-5 h-5 stroke-[2.5]" /></button>}
            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs border border-neutral-200/80">
              {botIcon ? <img src={botIcon.startsWith('http') ? botIcon : `https://ucarecdn.com/${botIcon}/`} alt={displayBotName} className="w-full h-full object-cover" /> : <span className="font-bold text-xs uppercase text-neutral-800">{displayBotName.slice(0, 2)}</span>}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[14px] tracking-tight uppercase">{displayBotName}</span>
                {realtimeMode?.mode && <span className="flex items-center gap-1 text-[9.5px] font-semibold text-emerald-600 bg-emerald-500/15 px-1.5 py-0.5 rounded-full border border-emerald-500/30"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live</span>}
              </div>
              <p className="text-[10.5px] opacity-70 flex items-center gap-1 leading-none mt-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Online</p>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-80">
            {realtimeMode?.chatroom && <RealTimeMode setChats={setChat} chatRoomId={realtimeMode.chatroom} />}
            <button type="button" onClick={() => setActiveTab((prev) => (prev === 'chat' ? 'helpdesk' : 'chat'))} className="p-1.5 rounded-lg transition-colors hover:bg-black/5" title={activeTab === 'chat' ? 'Open Helpdesk' : 'Back to Chat'}>{activeTab === 'chat' ? <HelpCircle className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}</button>
            <button type="button" onClick={() => setIsExpanded((prev) => !prev)} className="p-1.5 rounded-lg transition-colors hover:bg-black/5" title={isExpanded ? 'Collapse' : 'Expand'}><Maximize2 className="w-3.5 h-3.5" /></button>
            {onClose && <button type="button" onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-black/5" title="Close"><X className="w-4 h-4" /></button>}
          </div>
        </div>

        {activeTab === 'chat' && (
          <div className="flex flex-col flex-1 h-[calc(100%-54px)] relative bg-white">
            <div style={{ backgroundColor: '#FFFFFF', color: '#000000' }} className="flex-1 flex flex-col py-4 px-3.5 gap-3.5 chat-window overflow-y-auto scroll-smooth" ref={ref}>
              {chats.map((chat, key) => <Bubble key={key} message={chat} botIcon={botIcon} theme={activeTheme} textColor={activeTextColor} brandName={displayBotName} isLatest={key === chats.length - 1} onSelectOption={onSelectOption} onBookSlot={onBookSlot} onRestartChat={onRestartChat} />)}
              {onResponding && <Responding />}
            </div>
            <button type="button" onClick={scrollToBottom} className="absolute right-3.5 bottom-16 w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow-md hover:opacity-90 active:scale-95 transition-all z-10 opacity-80 hover:opacity-100" title="Scroll to bottom"><ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" /></button>
            <form onSubmit={onChat} className="px-3.5 py-2.5 bg-white border-t border-neutral-200/80 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 bg-neutral-100 rounded-full px-3 py-1 border border-neutral-200/60 focus-within:border-neutral-400 transition-colors">
                <Input {...register('content')} placeholder="Type your message..." className="focus-visible:ring-0 flex-1 px-1 py-1 text-[12.5px] bg-transparent rounded-none outline-none border-none text-black placeholder:text-neutral-400" />
                <Label htmlFor="bot-image" className="cursor-pointer text-neutral-400 hover:text-neutral-700 transition-colors p-1" title="Attach file"><Paperclip className="w-3.5 h-3.5" /><Input {...register('image')} type="file" id="bot-image" className="hidden" /></Label>
                <Button type="submit" size="sm" className="h-6 w-6 p-0 rounded-full bg-black text-white hover:bg-neutral-800 shadow-2xs shrink-0 flex items-center justify-center transition-transform active:scale-95" title="Send message"><Send className="w-3 h-3" /></Button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'helpdesk' && (
          <div className="flex-1 h-[calc(100%-54px)] overflow-y-auto p-4 flex flex-col gap-3 bg-white text-black">
            <div className="pb-2 border-b border-neutral-100"><h4 className="text-sm font-bold">Help Desk</h4></div>
            <div className="flex flex-col gap-2 pt-1 text-xs">
              {helpdesk?.length ? helpdesk.map((desk) => <Accordion key={desk.id} trigger={desk.question} content={desk.answer} />) : <p className="text-neutral-500">No help desk items configured.</p>}
            </div>
          </div>
        )}
      </div>
    )
  }
)

BotWindow.displayName = 'BotWindow'
