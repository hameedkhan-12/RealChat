import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User } from 'lucide-react'
import { BotIcon } from '@/icons/bot-icon'

type Message = {
  id: string
  senderType: 'VISITOR' | 'BOT' | 'AGENT'
  message: string
  createdAt: Date
  seen: boolean
  senderUserId: string | null
}

type Props = {
  messages: Message[]
  assignedAgentId: string | null
}

const SENDER_LABELS: Record<string, string> = {
  VISITOR: 'Visitor',
  BOT: 'AI Assistant',
  AGENT: 'Agent',
}

const SENDER_VARIANTS: Record<string, string> = {
  VISITOR: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
  BOT: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
  AGENT: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200',
}

export function ConversationTranscript({ messages, assignedAgentId }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8">
        No messages yet
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((m) => {
        const isAgent = m.senderType === 'AGENT'
        const isVisitor = m.senderType === 'VISITOR'
        const isBot = m.senderType === 'BOT'

        return (
          <div
            key={m.id}
            className="flex gap-3 max-w-[80%]"
            style={{
              alignSelf: isAgent ? 'flex-end' : 'flex-start',
              flexDirection: isAgent ? 'row-reverse' : 'row',
            }}
          >
            {!isAgent && (
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px]">
                {isBot ? (
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-muted flex items-center justify-center"><BotIcon /></div>
                ) : (
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className="bg-muted"><User /></AvatarFallback>
                  </Avatar>
                )}
              </div>
            )}
            <div
              className={`rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                SENDER_VARIANTS[m.senderType]
              }`}
            >
              {m.message}
            </div>
            {isAgent && (
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px]">
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="bg-muted"><User /></AvatarFallback>
                </Avatar>
              </div>
            )}
            <span
              className={`text-[10px] mt-1 block ${
                isAgent ? 'text-right' : 'text-left'
              } text-muted-foreground`}
            >
              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )
      })}
    </div>
  )
}
