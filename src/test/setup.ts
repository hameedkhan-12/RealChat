import { vi, beforeAll, afterAll } from 'vitest'

// Mock console to reduce noise in tests
const originalConsole = console.log
beforeAll(() => {
  console.log = vi.fn()

  // Some Node/jsdom combinations (Node 25) ship a non-functional
  // localStorage global. Provide a minimal in-memory implementation so
  // widget storage tests exercise the real code paths.
  if (typeof window !== 'undefined' && typeof window.localStorage?.setItem !== 'function') {
    const stores = new WeakMap<object, Map<string, string>>()
    const getStore = () => {
      if (!stores.has(window)) stores.set(window, new Map())
      return stores.get(window)!
    }
    const storage = {
      getItem(key: string) {
        return getStore().get(String(key)) ?? null
      },
      setItem(key: string, value: string) {
        getStore().set(String(key), String(value))
      },
      removeItem(key: string) {
        getStore().delete(String(key))
      },
      clear() {
        getStore().clear()
      },
      key(index: number) {
        return Array.from(getStore().keys())[index] ?? null
      },
      get length() {
        return getStore().size
      },
    }
    Object.defineProperty(window, 'localStorage', { value: storage, writable: true })
  }
})
afterAll(() => {
  console.log = originalConsole
})
