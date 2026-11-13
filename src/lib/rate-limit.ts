import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'

export type LimitResult = { success: boolean; remaining?: number; reset?: number }

let redis: Redis | null | undefined
function getRedis(): Redis | null {
  if (redis !== undefined) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  redis = url && token ? new Redis({ url, token }) : null
  return redis
}

const limiters = new Map<string, Ratelimit>()
function limiterFor(r: Redis, limit: number, windowSeconds: number) {
  const k = `${limit}:${windowSeconds}`
  let l = limiters.get(k)
  if (!l) {
    l = new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`), prefix: 'rc' })
    limiters.set(k, l)
  }
  return l
}

const mem = new Map<string, { count: number; reset: number }>()
function memoryLimit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now()
  const e = mem.get(key)
  if (!e || e.reset <= now) {
    mem.set(key, { count: 1, reset: now + windowMs })
    return { success: true, remaining: limit - 1 }
  }
  if (e.count >= limit) return { success: false, remaining: 0, reset: e.reset }
  e.count++
  return { success: true, remaining: limit - e.count }
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<LimitResult> {
  const r = getRedis()
  if (!r) return memoryLimit(key, limit, windowSeconds * 1000)
  try {
    const res = await limiterFor(r, limit, windowSeconds).limit(key)
    return { success: res.success, remaining: res.remaining, reset: res.reset }
  } catch (e) {
    logger.error('rate limit backend failed, using memory fallback', { error: String(e) })
    return memoryLimit(key, limit, windowSeconds * 1000)
  }
}

/**
 * Client IP. Never use the raw x-forwarded-for string as a key (the client controls its left side).
 * TRUSTED_PROXY_COUNT = how many proxies of ours append to x-forwarded-for (Vercel: 1).
 */
export function getClientIp(req: Request): string {
  const vercel = req.headers.get('x-vercel-forwarded-for')
  if (vercel) return vercel.split(',')[0]!.trim()
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean)
    const n = Number(process.env.TRUSTED_PROXY_COUNT ?? 1)
    return parts[Math.max(0, parts.length - Math.max(1, n))] ?? 'unknown'
  }
  return req.headers.get('x-real-ip') ?? 'unknown'
}
