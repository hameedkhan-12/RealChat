/**
 * Widget browser storage helpers.
 *
 * Every widget session value is scoped by the tenant's public key so two
 * widgets embedded on the same origin can never read or overwrite each
 * other's session token.
 */

const PUBLIC_KEY_RE = /^[0-9a-f]{32,64}$/i

export function widgetStorageKey(publicKey: string, suffix: string): string {
  return `realchat:${publicKey}:${suffix}`
}

/** Reads the public key from the widget iframe URL (`/chatbot?key=...`). */
export function getWidgetPublicKeyFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const key = new URLSearchParams(window.location.search).get('key')
  return key && PUBLIC_KEY_RE.test(key) ? key : null
}

/**
 * Reads the scoped session token. When `publicKey` is omitted the key is
 * derived from the current URL, which is the iframe's source of truth.
 */
export function readWidgetSessionToken(publicKey?: string | null): string | null {
  if (typeof window === 'undefined') return null
  const key = publicKey || getWidgetPublicKeyFromUrl()
  if (!key) return null
  return window.localStorage.getItem(widgetStorageKey(key, 'session_token'))
}
