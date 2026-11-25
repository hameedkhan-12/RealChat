import { z } from 'zod'

export const DashboardConversationQuerySchema = z.object({
  domain: z.string().uuid().optional(),
  status: z.enum(['BOT', 'WAITING_AGENT', 'LIVE', 'CLOSED']).optional(),
  search: z.string().trim().max(200).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
})

export type DashboardConversationQuery = z.infer<typeof DashboardConversationQuerySchema>
