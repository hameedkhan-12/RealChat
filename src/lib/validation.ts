import { z } from 'zod'

export const messageSchema = z.object({
  sessionToken: z.string().min(10).max(256).optional(),
  key: z.string().min(10).max(64).optional(), // publicKey
  message: z.string().max(1000).optional(),
  stepKey: z.string().max(100).optional(),
  answer: z.union([z.string().max(1000), z.array(z.string().max(200)).max(20)]).optional(),
  pageUrl: z.string().url().max(2000).optional().or(z.literal('')),
  utm: z.record(z.string().max(200)).optional(),
})

export const sessionSchema = z.object({
  key: z.string().min(10).max(64),
  turnstileToken: z.string().optional(),
  pageUrl: z.string().url().max(2000).optional().or(z.literal('')),
  utm: z.record(z.string().max(200)).optional(),
})

export const bookingSchema = z.object({
  sessionToken: z.string().min(10).max(256),
  startsAt: z.string().datetime().optional(),
  slot: z.string().max(100).optional(),
  date: z.string().max(50).optional(),
  name: z.string().max(200).optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(40).optional(),
})

export const handoffSchema = z.object({
  sessionToken: z.string().min(10).max(256),
  reason: z.string().max(500).optional(),
})

export function isHexColor(v?: string | null) {
  if (!v) return true
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)
}
export function isHttpsUrl(v?: string | null) {
  if (!v) return true
  try { const u = new URL(v); return u.protocol === 'https:' } catch { return false }
}
