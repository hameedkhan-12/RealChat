/** Returns "https://example.com" style origin or null if not acceptable. */
export function normalizeOrigin(input: string, opts: { allowLocalHttp?: boolean } = {}): string | null {
  let u: URL
  try {
    u = new URL(input.trim())
  } catch {
    return null
  }
  const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  const allowLocal = opts.allowLocalHttp ?? process.env.NODE_ENV !== 'production'
  if (u.protocol === 'https:') return u.origin
  if (u.protocol === 'http:' && isLocal && allowLocal) return u.origin
  return null
}

export function normalizeOrigins(list: string[], max = 10): string[] {
  const out = new Set<string>()
  for (const raw of list) {
    const o = normalizeOrigin(raw)
    if (o) out.add(o)
    if (out.size >= max) break
  }
  return [...out]
}
