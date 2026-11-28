import { afterEach, describe, expect, it } from 'vitest'
import {
  getWidgetPublicKeyFromUrl,
  readWidgetSessionToken,
  widgetStorageKey,
} from '@/lib/widget-storage'

const PUBLIC_KEY = 'abcdef1234567890abcdef1234567890abcdef12'
const OTHER_KEY = '0123456789abcdef0123456789abcdef01234567'

describe('widget storage scoping', () => {
  afterEach(() => {
    window.localStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('builds public-key-scoped storage keys', () => {
    expect(widgetStorageKey(PUBLIC_KEY, 'session_token')).toBe(
      `realchat:${PUBLIC_KEY}:session_token`
    )
  })

  it('reads the scoped token for an explicit public key', () => {
    window.localStorage.setItem(widgetStorageKey(PUBLIC_KEY, 'session_token'), 'scoped-token')
    expect(readWidgetSessionToken(PUBLIC_KEY)).toBe('scoped-token')
  })

  it('derives the public key from the widget iframe URL', () => {
    window.history.pushState({}, '', `/chatbot?key=${PUBLIC_KEY}`)
    window.localStorage.setItem(widgetStorageKey(PUBLIC_KEY, 'session_token'), 'url-token')
    expect(getWidgetPublicKeyFromUrl()).toBe(PUBLIC_KEY)
    expect(readWidgetSessionToken()).toBe('url-token')
  })

  it('never falls back to the legacy unscoped token key', () => {
    window.localStorage.setItem('realchat_session_token', 'legacy-token')
    expect(readWidgetSessionToken(PUBLIC_KEY)).toBeNull()
  })

  it('does not leak one widget key token into another', () => {
    window.localStorage.setItem(widgetStorageKey(OTHER_KEY, 'session_token'), 'other-token')
    expect(readWidgetSessionToken(PUBLIC_KEY)).toBeNull()
  })
})
