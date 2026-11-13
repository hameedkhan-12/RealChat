import 'server-only'
import { z } from 'zod'

const optional = z.string().optional()

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  PUSHER_APP_ID: optional, PUSHER_KEY: optional, PUSHER_SECRET: optional, PUSHER_CLUSTER: optional,
  NEXT_PUBLIC_PUSHER_KEY: optional, NEXT_PUBLIC_PUSHER_CLUSTER: optional,
  UPSTASH_REDIS_REST_URL: optional, UPSTASH_REDIS_REST_TOKEN: optional,
  TURNSTILE_SECRET_KEY: optional, NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional,
  SMTP_HOST: optional, SMTP_PORT: optional, SMTP_SECURE: optional,
  SMTP_USER: optional, SMTP_PASS: optional, SMTP_FROM: optional,
  CRON_SECRET: optional,
  AI_API_KEY: optional, AI_BASE_URL: optional, AI_MODEL: optional,
  WIDGET_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  TRUSTED_PROXY_COUNT: z.coerce.number().int().min(0).max(5).default(1),
  RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(365),
})

const PROD_REQUIRED = [
  'PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER',
  'NEXT_PUBLIC_PUSHER_KEY', 'NEXT_PUBLIC_PUSHER_CLUSTER',
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
  'TURNSTILE_SECRET_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'CRON_SECRET',
] as const

export type Env = z.infer<typeof schema>
let cached: Env | undefined

export function getEnv(): Env {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) throw new Error('Invalid environment: ' + JSON.stringify(parsed.error.flatten().fieldErrors))
  const env = parsed.data
  // During `next build` NODE_ENV is "production" but secrets may be absent; skip the strict check there.
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
  if (env.NODE_ENV === 'production' && !isBuild) {
    const missing = PROD_REQUIRED.filter((k) => !(env as Record<string, unknown>)[k])
    if (missing.length) throw new Error('Missing required production env vars: ' + missing.join(', '))
  }
  cached = env
  return env
}
