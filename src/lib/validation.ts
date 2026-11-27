import { z } from 'zod'

export const EmailSchema = z.string().trim().toLowerCase().email().max(254)
export const NameSchema = z.string().trim().min(1).max(120)
export const PhoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s().-]/g, ''))
  .refine((s) => /^\+?[0-9]{7,15}$/.test(s), 'INVALID_PHONE')

export const PublicKeySchema = z.string().regex(/^[0-9a-f]{32,64}$/i)
export const LocaleSchema = z.enum(['en', 'ar'])
export const IanaTimezoneSchema = z.string().max(64).refine((tz) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}, 'INVALID_TIMEZONE')

const Utm = z.record(z.string().max(100)).refine((o) => Object.keys(o).length <= 10, 'TOO_MANY_KEYS')

export const SessionBody = z.object({
  key: PublicKeySchema,
  turnstileToken: z.string().max(2048).optional(),
  pageUrl: z.string().url().max(500).optional(),
  utm: Utm.optional(),
  locale: LocaleSchema.optional(),
})

export const MessageBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CONSENT'), accepted: z.boolean() }),
  z.object({
    kind: z.literal('FLOW_ANSWER'),
    stepKey: z.string().trim().min(1).max(60),
    answer: z.union([
      z.string().max(2000),
      z.array(z.string().max(200)).max(20),
      z.number(),
      z.boolean(),
      z.null(),
    ]),
    idempotencyKey: z.string().trim().min(1).max(128).optional(),
  }),
  z.object({ kind: z.literal('QUESTION'), content: z.string().trim().min(1).max(2000), locale: z.string().min(2).max(10).optional() }),
])

export const HandoffBody = z.object({ reason: z.string().trim().max(300).optional() })

export const AvailabilityQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})

export const BookingBody = z.object({
  startsAt: z.string().datetime(),
  name: NameSchema,
  email: EmailSchema,
  phone: PhoneSchema.optional(),
  visitorTimezone: IanaTimezoneSchema.optional(),
})

export const ManageCancelBody = z.object({
  bookingId: z.string().uuid(),
  token: z.string().min(32).max(128),
})

export const FlowStepTypeSchema = z.enum(['CHOICE', 'MULTI_CHOICE', 'TEXT', 'NUMBER', 'EMAIL', 'PHONE'])
export const FlowStepMapsToSchema = z.enum(['NONE', 'NAME', 'EMAIL', 'PHONE'])

/** Shared widget config contract used by both API and client. */
export const WidgetConfigSchema = z.object({
  ok: z.literal(true),
  domain: z.object({
    publicKey: z.string(),
    name: z.string(),
    timezone: z.string(),
    defaultLocale: z.string(),
  }),
  brand: z.object({
    name: z.string(),
    logoUrl: z.string().nullable(),
    primaryColor: z.string().nullable(),
    textColor: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    position: z.string().nullable(),
    welcomeMessage: z.string().nullable(),
    consentText: z.string().nullable(),
    privacyPolicyUrl: z.string().nullable(),
    offlineMessage: z.string().nullable(),
    showPoweredBy: z.boolean(),
    launcherLabel: z.string().nullable(),
  }),
  features: z.object({
    questionnaire: z.boolean(),
    handoff: z.boolean(),
    booking: z.boolean(),
  }),
  turnstile: z.object({
    enabled: z.boolean(),
    siteKey: z.string().nullable(),
  }),
  flow: z.object({
    version: z.number(),
    steps: z.array(
      z.object({
        key: z.string(),
        question: z.string(),
        type: z.string(),
        required: z.boolean(),
        options: z.array(z.string()).optional(),
      }),
    ),
  }),
})
export type WidgetConfigResponse = z.infer<typeof WidgetConfigSchema>

export const FlowStepOptionSchema = z.object({
  label: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(200),
  nextStepKey: z.string().trim().min(1).max(60).optional(),
})

export const FlowStepUpsertSchema = z.object({
  position: z.number().int().min(1).max(1000),
  key: z.string().trim().min(1).max(60),
  type: FlowStepTypeSchema,
  prompt: z.string().trim().min(1).max(2000),
  options: z.array(FlowStepOptionSchema).max(50),
  required: z.boolean(),
  mapsTo: FlowStepMapsToSchema,
  isActive: z.boolean(),
})

/** Shared widget questionnaire answer contract (used by API and client). */
export const FlowAnswerRequestSchema = z.object({
  type: z.literal('FLOW_ANSWER'),
  stepKey: z.string().trim().min(1).max(60),
  answer: z.union([
    z.string().max(2000),
    z.array(z.string().max(200)).max(20),
    z.number(),
    z.boolean(),
    z.null(),
  ]),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
})

export type FlowAnswerRequest = z.infer<typeof FlowAnswerRequestSchema>

export const FlowAnswerStepSchema = z.object({
  key: z.string(),
  question: z.string(),
  type: z.string(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
})

export const FlowAnswerResponseSchema = z.object({
  ok: z.literal(true),
  flowCompleted: z.boolean(),
  currentStep: FlowAnswerStepSchema.nullable(),
  savedAnswer: z.object({
    stepKey: z.string(),
    answer: z.unknown(),
  }),
})

export type FlowAnswerResponse = z.infer<typeof FlowAnswerResponseSchema>

export const isHexColor = (v?: string | null) => !v || /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)
export const isHttpsUrl = (v?: string | null) => {
  if (!v) return true
  try { return new URL(v).protocol === 'https:' } catch { return false }
}
