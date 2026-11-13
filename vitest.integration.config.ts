import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@/lib/prisma': path.resolve(__dirname, './src/test/mockPrisma.ts'),
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, '../src/test/mockServerOnly.ts'),
      '@clerk/nextjs/server': path.resolve(__dirname, '../src/test/mockClerkServer.ts'),
    },
  },
  test: {
    include: ['src/__integration__/**/*.test.ts'],
    passWithNoTests: true,
  },
})
