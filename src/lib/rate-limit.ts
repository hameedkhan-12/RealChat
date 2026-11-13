import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type LimitResult = { success: boolean; limit?: number; remaining?: number; reset?: number }

let redis: Redis | null = null
function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  if (!redis) redis = new Redis({ url, token })
  return redis
}

const mem = new Map<string, { count: number; reset: number }>()
function memoryLimit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now()
  const entry = mem.get(key)
  if (!entry || entry.reset <= now) {
    mem.set(key, { count: 1, reset: now + windowMs })
    return { success: true, remaining: limit - 1 }
  }
  if (entry.count >= limit) return { success: false, remaining: 0, reset: entry.reset }
  entry.count++
  return { success: true, remaining: limit - entry.count }
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<LimitResult> {
  const r = getRedis()
  if (!r) return memoryLimit(key, limit, windowSeconds * 1000)
  try {
    const rl = new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`), prefix: 'rl' })
    const res = await rl.limit(key)
    return { success: res.success, limit: res.limit, remaining: res.remaining, reset: res.reset }
  } catch {
    return memoryLimit(key, limit, windowSeconds * 1000)
  }
}

export function getClientIp(req: Request) {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') || 'unknown'
}
