import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User } from 'lucide-react'

type Props = {
  conversation: {
    id: string
    status: string
    assignedToUserId: string | null
    lastActivityAt: Date | null
    createdAt: Date | null
    customer: {
      id: string
      name: string | null
      email: string | null
      phone: string | null
    }
    flowCompletedAt: Date | null
    assignedAgent?: {
      id: string
      fullname: string | null
    } | null
  }
}

const STATUS_LABELS: Record<string, string> = {
  BOT: 'Bot',
  WAITING_AGENT: 'Waiting Agent',
  LIVE: 'Live',
  CLOSED: 'Closed',
}

const STATUS_VARIANTS: Record<string, string> = {
  BOT: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  WAITING_AGENT: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  LIVE: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
}

export function ConversationHeader({ conversation }: Props) {
  return (
    <div className="border-b p-4 bg-muted/50 flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className="bg-muted"><User /></AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold truncate">
            {conversation.customer.name || conversation.customer.email || 'Unknown Customer'}
          </h2>
          <p className="text-xs text-muted-foreground truncate">
            {conversation.customer.email || conversation.customer.phone || 'No contact info'}
          </p>
        </div>
        <Badge variant="secondary" className={STATUS_VARIANTS[conversation.status] || 'bg-muted'}>
          {STATUS_LABELS[conversation.status] || conversation.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span>Status:</span>
          <span className="font-medium">{STATUS_LABELS[conversation.status] || conversation.status}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>Assigned Agent:</span>
          <span className="font-medium">
            {conversation.assignedAgent?.fullname || conversation.assignedToUserId || '—'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span>Questionnaire:</span>
          <span className="font-medium">
            {conversation.flowCompletedAt ? 'Completed' : 'Incomplete'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span>Last Activity:</span>
          <span className="font-medium">
            {conversation.lastActivityAt
              ? new Date(conversation.lastActivityAt).toLocaleString()
              : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
