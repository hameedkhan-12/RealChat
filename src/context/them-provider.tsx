'use client'

import * as React from 'react'
import type { ComponentProps } from 'react'

// next-themes' ThemeProvider renders a <script> tag which Next.js 16 Turbopack
// rejects on the client. We provide a minimal theme context instead that
// manages the document class via useEffect, avoiding the script tag entirely.
type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
  systemTheme: 'light' | 'dark'
  mounted: boolean
}

const ThemeContext: React.Context<ThemeContextValue | null> = React.createContext<ThemeContextValue | null>(null)

type ThemeProviderProps = {
  children: React.ReactNode
  theme?: Theme
  defaultTheme?: Theme
  storageKey?: string
  attribute?: string
  nonce?: string
  disableTransitionOnChange?: boolean
  [key: string]: unknown
}

const subscribeNoop = () => () => {}

const themeListeners = new Set<() => void>()

function notifyThemeChange() {
  themeListeners.forEach((listener) => listener())
}

function subscribeToTheme(callback: () => void) {
  themeListeners.add(callback)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null) callback()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    themeListeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

function readStoredTheme(storageKey: string): Theme | undefined {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // localStorage can be unavailable (private mode, blocked cookies).
  }
  return undefined
}

function subscribeToSystemTheme(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({
  children,
  theme: forcedTheme,
  defaultTheme = 'system',
  storageKey = 'theme',
  ...props
}: ThemeProviderProps) {
  // `useSyncExternalStore` gives us the post-hydration value without an
  // effect that sets state synchronously.
  const mounted = React.useSyncExternalStore(subscribeNoop, () => true, () => false)
  const systemTheme = React.useSyncExternalStore(subscribeToSystemTheme, getSystemTheme, () => 'light' as const)
  const persistedTheme = React.useSyncExternalStore(
    subscribeToTheme,
    () => readStoredTheme(storageKey),
    () => undefined
  )
  const [overrideTheme, setOverrideTheme] = React.useState<Theme | undefined>(undefined)

  const storedTheme = overrideTheme ?? forcedTheme ?? persistedTheme
  const theme = storedTheme ?? defaultTheme
  const resolvedTheme = theme === 'system' ? systemTheme : theme

  React.useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
    if (forcedTheme !== undefined || storedTheme !== undefined) {
      window.localStorage.setItem(storageKey, theme)
    }
  }, [theme, resolvedTheme, mounted, storageKey, forcedTheme, storedTheme])

  const setTheme = (nextTheme: Theme) => {
    setOverrideTheme(nextTheme)
    try {
      window.localStorage.setItem(storageKey, nextTheme)
    } catch {
      // Persisting is best-effort; the in-memory theme still applies.
    }
    notifyThemeChange()
  }

  const value: ThemeContextValue = {
    theme,
    setTheme,
    resolvedTheme,
    systemTheme,
    mounted,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}

export { ThemeContext }
