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

export function ThemeProvider({
  children,
  theme: forcedTheme,
  defaultTheme = 'system',
  storageKey = 'theme',
  ...props
}: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false)
  const [storedTheme, setStoredTheme] = React.useState<Theme | undefined>(forcedTheme)
  const [systemTheme, setSystemTheme] = React.useState<'light' | 'dark'>('light')

  React.useEffect(() => {
    setMounted(true)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    setSystemTheme(media.matches ? 'dark' : 'light')
    return () => media.removeEventListener('change', onChange)
  }, [])

  React.useEffect(() => {
    if (!mounted || storedTheme !== undefined) return
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(storageKey)
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setStoredTheme(stored)
      }
    }
  }, [mounted, storedTheme, storageKey])

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
    setStoredTheme(nextTheme)
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
