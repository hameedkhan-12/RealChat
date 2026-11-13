import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BotIcon } from '@/icons/bot-icon'
import Image from 'next/image'
import { Send } from 'lucide-react'

type Props = {
  domainName: string
  botIcon?: string | null
  themeColor: string
  textColor: string
  botName?: string
  branding?: string
  welcomeMessage?: string
}

const BotLivePreview = ({
  domainName,
  botIcon,
  themeColor,
  textColor,
  botName,
  branding,
  welcomeMessage,
}: Props) => {
  const displayTitle =
    botName || (domainName ? `${domainName.split('.')[0]} Assistant` : 'Sales Assistant')
  const displayBranding =
    branding || (domainName ? `Powered by ${domainName.split('.')[0]}` : 'Powered by RealChat')
  const displayGreeting =
    welcomeMessage || 'Hey there! Have a question? Let me help you today.'

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground self-start flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Live Chatbot Widget Preview
      </div>

      <div className="w-full max-w-[380px] rounded-2xl border shadow-xl bg-card overflow-hidden flex flex-col text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-muted/40">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border">
              <AvatarImage
                src={
                  botIcon
                    ? `https://ucarecdn.com/${botIcon}/`
                    : 'https://github.com/shadcn.png'
                }
                alt="bot preview"
              />
              <AvatarFallback>
                {domainName?.slice(0, 2).toUpperCase() || 'AI'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <h4 className="font-bold text-sm leading-tight">{displayTitle}</h4>
              <p className="text-[11px] text-emerald-500 font-medium">● Online</p>
            </div>
          </div>
          {botIcon && (
            <div className="relative w-7 h-7 rounded-full overflow-hidden border">
              <Image
                src={`https://ucarecdn.com/${botIcon}/`}
                fill
                alt="bot"
                className="object-cover"
              />
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="p-3 flex flex-col gap-3 min-h-[260px] bg-background/50">
          {/* Assistant Greeting Bubble */}
          <div className="flex items-end gap-2 self-start max-w-[85%]">
            <Avatar className="w-6 h-6 border">
              <AvatarImage
                src={
                  botIcon
                    ? `https://ucarecdn.com/${botIcon}/`
                    : 'https://github.com/shadcn.png'
                }
                alt="avatar"
              />
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>
            <div className="bg-muted p-2.5 rounded-2xl rounded-bl-sm text-xs shadow-sm">
              <p className="leading-relaxed">{displayGreeting}</p>
            </div>
          </div>

          {/* Sample User Bubble */}
          <div className="flex items-end gap-2 self-end max-w-[85%] flex-row-reverse">
            <div
              style={{ backgroundColor: themeColor, color: textColor }}
              className="p-2.5 rounded-2xl rounded-br-sm text-xs shadow-sm font-medium"
            >
              <p>Can you tell me more about your pricing?</p>
            </div>
          </div>
        </div>

        {/* Input Bar Preview */}
        <div className="p-2.5 border-t bg-muted/30 flex items-center gap-2">
          <div className="flex-1 bg-background border rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
            Type your message...
          </div>
          <button
            type="button"
            style={{ backgroundColor: themeColor, color: textColor }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-90"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Custom Branding Footer */}
        <div className="py-1.5 px-3 border-t bg-muted/20 text-center">
          <span className="text-[11px] text-muted-foreground font-medium">
            {displayBranding}
          </span>
        </div>
      </div>

      {/* Launcher Button Preview */}
      <div className="flex items-center gap-3 self-end mr-4">
        <span className="text-xs text-muted-foreground">Launcher:</span>
        <div
          style={{ backgroundColor: themeColor }}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
        >
          {botIcon ? (
            <div className="relative w-full h-full rounded-full overflow-hidden">
              <Image
                src={`https://ucarecdn.com/${botIcon}/`}
                fill
                alt="launcher"
                className="object-cover"
              />
            </div>
          ) : (
            <BotIcon />
          )}
        </div>
      </div>
    </div>
  )
}

export default BotLivePreview

