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

export const MessageBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('consent') }),
  z.object({
    type: z.literal('answer'),
    expectedStepKey: z.string().max(60),
    answer: z.union([z.string().max(1000), z.array(z.string().max(200)).max(20), z.null()]),
  }),
  z.object({ type: z.literal('text'), text: z.string().trim().min(1).max(1000) }),
  z.object({ type: z.literal('finish') }),
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

export const isHexColor = (v?: string | null) => !v || /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)
export const isHttpsUrl = (v?: string | null) => {
  if (!v) return true
  try { return new URL(v).protocol === 'https:' } catch { return false }
}
