import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@/lib/prisma': path.resolve(__dirname, './src/test/mockPrisma.ts'),
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './src/test/mockServerOnly.ts'),
      '@clerk/nextjs/server': path.resolve(__dirname, './src/test/mockClerkServer.ts'),
    },
  },
})
