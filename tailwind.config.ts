// Tailwind CSS v4 — configuration has moved to globals.css via @theme.
// This file is kept for backwards compatibility with tooling that imports it.
import type { Config } from 'tailwindcss'

const config = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
} satisfies Config

export default config
