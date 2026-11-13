'use client'

import { useEffect, useState } from 'react'
import { useChatBot } from '@/hooks/chatbot/use-chatbot'
import { getStrings } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Send, Maximize2, User } from 'lucide-react'

type Props = {
  publicKey?: string
  pageUrl?: string
  utm?: Record<string, string>
  lang?: 'en' | 'ar'
}

export default function ChatWidget({ publicKey, pageUrl, utm, lang }: Props) {
  const {
    botOpened, onOpenChatBot, handleSendMessage, onSelectOption, onBookSlot, onRestartChat,
    onChats, onAiTyping, currentBot, loading, config, sessionToken,
    consentGiven, setConsentGiven, requestHandoff, status, acceptConsent,
  } = useChatBot(publicKey)

  const brand = config?.brand
  const domainName = config?.domainName || 'Business'
  const botName = brand?.botName || domainName || 'Assistant'
  const welcome = brand?.welcomeMessage || currentBot?.welcomeMessage || 'Hi! How can we help you today?'
  const position = brand?.position === 'BOTTOM_LEFT' ? 'BOTTOM_LEFT' : 'BOTTOM_RIGHT'
  const primary = brand?.primaryColor || '#0f172a'
  const textColor = brand?.textColor || '#ffffff'
  const avatarUrl = brand?.avatarUrl
  const defaultLocale: Lang = (lang || config?.defaultLocale || 'en') as Lang
  const strings = getStrings(defaultLocale)
  const isRTL = defaultLocale === 'ar'
  const handoffEnabled = config?.features.handoff !== false
  const bookingEnabled = config?.features.booking !== false
  const consentRequired = !!brand?.consentText && !consentGiven

  const [expanded, setExpanded] = useState(false)
  const launcherSideCls = position === 'BOTTOM_LEFT' ? 'left-4' : 'right-4'
  const launcherLabelCls = `absolute -top-6 ${position === 'BOTTOM_LEFT' ? 'left-0' : 'right-0'} whitespace-nowrap text-[11px] font-medium bg-black/80 text-white px-2 py-1 rounded`
  const winPosStyle: React.CSSProperties = {
    position: position === 'BOTTOM_LEFT' ? 'left' : 'right' as 'left' | 'right',
    bottom: '4px',
  } as React.CSSProperties
  winPosStyle[position === 'BOTTOM_LEFT' ? 'left' : 'right'] = '4px'

  if (consentRequired) {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="fixed inset-0 z-[2147483647] flex flex-col h-screen w-screen max-w-none"
        style={{ backgroundColor: primary, color: textColor }}
      >
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt={botName} className="w-16 h-16 rounded-full mb-4 object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-4">
              <span className="font-bold text-sm">{botName.slice(0, 2)}</span>
            </div>
          )}
          <h2 className="text-lg font-bold mb-2">{botName}</h2>
          <p className="text-sm mb-6 opacity-90 max-w-md">{brand?.consentText || 'By continuing you agree to our terms.'}</p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <Button
              onClick={() => { setConsentGiven(true); acceptConsent() }}
              className="flex-1"
              disabled={loading}
            >
              {loading ? '…' : strings.connectLiveAgentShort || 'Accept'}
            </Button>
            <Button variant="outline" onClick={onOpenChatBot} className="flex-1">
              {strings.noThanks || 'No thanks'}
            </Button>
          </div>
          {brand?.showPoweredBy !== false && (
            <p className="mt-6 text-[10px] opacity-60">Powered by RealChat</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={`fixed z-[2147483647] cursor-pointer select-none ${launcherSideCls} bottom-4 ${expanded ? 'w-[460px] h-[660px]' : 'w-12 h-12'} transition-all duration-300 ease-out flex items-center justify-center ${!expanded ? 'rounded-full' : 'rounded-2xl'} shadow-2xl`}
        style={{ backgroundColor: expanded ? '#ffffff' : primary, color: expanded ? '#0f172a' : textColor }}
        onClick={() => setExpanded((p) => !p)}
      >
        {!expanded && (
          <div className="relative w-10 h-10 rounded-full flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt={botName} className="w-full h-full rounded-full object-cover border-2 border-white" />
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center bg-white/20 border border-white/30">
                <span className="font-bold text-xs">{botName.slice(0, 1)}</span>
              </div>
            )}
            <div className="absolute right-0 bottom-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
          </div>
        )}
        {brand?.launcherLabel && !expanded && (
          <span className={launcherLabelCls}>{brand.launcherLabel}</span>
        )}
        {expanded && (
          <button type="button" className="absolute right-2 top-2 p-1.5 rounded hover:bg-black/10" onClick={(e) => { e.stopPropagation(); setExpanded(false) }} title="Close">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {expanded && (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed z-[2147483647] w-[460px] h-[660px] max-w-[92vw] max-h-[92vh] flex flex-col" style={winPosStyle}>
          <div className="flex flex-col h-full border border-neutral-200/80 shadow-2xl rounded-2xl overflow-hidden bg-white">
            <div className="px-4 py-3 flex items-center gap-3 border-b border-neutral-200/80 shrink-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={botName} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-xs text-neutral-700">{botName.slice(0, 2)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-neutral-900 truncate">{botName}</span>
                  {status === 'LIVE' && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-500/15 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {strings.live || 'Live'}
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] opacity-70 truncate mt-0.5">
                  {status === 'WAITING_AGENT' ? 'Waiting for an agent…' : strings.online || 'Online'}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 opacity-70">
                {handoffEnabled && status === 'BOT' && (
                  <button type="button" onClick={requestHandoff} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-600 transition-colors" title={strings.talkToAPerson || 'Talk to a person'}>
                    <User className="w-4 h-4" />
                  </button>
                )}
                <button type="button" className="p-1.5 rounded hover:bg-neutral-100" onClick={() => setExpanded(false)} title="Collapse">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth relative">
              {loading && <div className="text-[12px] text-neutral-500">Loading…</div>}
              {!loading && onChats.length === 0 && (
                <div className="text-[12px] text-neutral-500 text-center mt-10">{welcome}</div>
              )}
              {onChats.map((m, i) => {
                const isUser = m.role === 'user'
                const bubbleCls = `max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${isUser ? `bg-[${primary}] text-white rounded-tr-xs shadow-sm` : 'bg-[#F3F4F6] text-[#18181B] rounded-tl-xs shadow-sm border border-neutral-200/40'}`
                const optionCls = `px-3 py-1.5 text-xs font-medium rounded-xl border border-[${primary}] text-[${primary}] bg-white hover:bg-[${primary}] hover:text-white transition-colors cursor-pointer`
                return (
                  <div key={i} className={isUser ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={bubbleCls}>
                      {m.content}
                      {m.role === 'assistant' && m.options && m.options.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {m.options.map((o: string, j: number) => (
                            <button key={j} type="button" onClick={() => onSelectOption(o)} className={optionCls}>{o}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    {m.role === 'assistant' && m.widget === 'chat-ended' && (
                      <div className="mt-3 flex gap-2">
                        {bookingEnabled && (
                          <button type="button" onClick={onBookSlot} className="px-3 py-1.5 text-xs rounded border border-neutral-300 hover:bg-neutral-50">{strings.bookACall || 'Book a call'}</button>
                        )}
                        {handoffEnabled && (
                          <button type="button" onClick={requestHandoff} className="px-3 py-1.5 text-xs rounded border border-neutral-300 hover:bg-neutral-50">{strings.talkToAPerson || 'Talk to a person'}</button>
                        )}
                        <button type="button" onClick={onRestartChat} className="px-3 py-1.5 text-xs rounded border border-neutral-300 hover:bg-neutral-50">{strings.noThanks || 'No thanks'}</button>
                      </div>
                    )}
                    {m.role === 'assistant' && (
                      <div className="text-[10px] text-neutral-400 mt-0.5 self-end">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    )}
                  </div>
                )
              })}
              {onAiTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#F3F4F6] px-4 py-3 rounded-2xl rounded-tl-xs text-sm text-[#18181B]">{botName} is typing…</div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="px-4 py-3 border-t border-neutral-200/80 shrink-0 bg-white">
              <div className="flex items-center gap-2 bg-neutral-50 rounded-full px-3 py-1.5 border border-neutral-200/60">
                <Label htmlFor="widget-input" className="sr-only">{strings.send || 'Send message'}</Label>
                <Input id="widget-input" placeholder={strings.placeholder || "Type your message…"} className="flex-1 bg-transparent text-[13px] text-neutral-900 placeholder:text-neutral-400 outline-none" disabled={!sessionToken} />
                <Button type="submit" size="sm" className="h-7 w-7 p-0 rounded-full flex items-center justify-center" style={{ backgroundColor: primary, color: '#ffffff' }} disabled={!sessionToken || onAiTyping}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
