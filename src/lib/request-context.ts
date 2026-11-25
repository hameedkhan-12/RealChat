import type { AsyncLocalStorage } from 'node:async_hooks'

export type RequestContext = {
  requestId: string
}

let alsInstance: AsyncLocalStorage<RequestContext> | null = null
let alsResolved = false

async function getAls(): Promise<AsyncLocalStorage<RequestContext> | null> {
  if (alsResolved) return alsInstance
  alsResolved = true
  try {
    // Lazy-load so the module works in Edge runtimes that lack node:async_hooks.
    const mod = await import('node:async_hooks')
    alsInstance = new mod.AsyncLocalStorage<RequestContext>()
  } catch {
    alsInstance = null
  }
  return alsInstance
}

/** Run a callback within a request context (e.g. per incoming HTTP request). */
export async function withRequestContext<T>(
  requestId: string,
  cb: () => Promise<T> | T,
): Promise<T> {
  const als = await getAls()
  if (!als) return cb()
  return als.run({ requestId }, async () => cb())
}

/** Returns the current request context, or null if outside a request. */
export function getRequestContext(): RequestContext | null {
  return alsInstance?.getStore() ?? null
}

/** Returns the current request ID, or null if outside a request. */
export function getRequestId(): string | null {
  return getRequestContext()?.requestId ?? null
}

/** Generate a cryptographically random request ID using the Web Crypto API
 *  (available in both Node.js and Edge runtimes). */
export function createRequestId(): string {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}
