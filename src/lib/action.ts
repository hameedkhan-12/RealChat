import 'server-only'
import { ZodError } from 'zod'
import { AuthError, HttpError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; issues?: { path: string; message: string }[] }

export async function action<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code, status: e.status }
    if (e instanceof HttpError) return { ok: false, error: e.code, status: e.status }
    if (e instanceof ZodError) {
      return {
        ok: false,
        error: 'VALIDATION',
        status: 400,
        issues: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      }
    }
    logger.error('action failed', { error: e instanceof Error ? e.message : String(e) })
    return { ok: false, error: 'INTERNAL', status: 500 }
  }
}
