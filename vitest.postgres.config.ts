import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './src/test/mockServerOnly.ts'),
      '@clerk/nextjs/server': path.resolve(__dirname, './src/test/mockClerkServer.ts'),
    },
  },
  test: {
    // Real PostgreSQL integration tests only. Uses the real Prisma client
    // (no @/lib/prisma mock alias) against a dedicated test database.
    include: ['src/__integration__/pg/**/*.pg.test.ts'],
    exclude: [],
    passWithNoTests: false,
    testTimeout: 60000,
    hookTimeout: 60000,
    setupFiles: ['./src/__integration__/pg/setup.ts'],
    environment: 'node',
  },
})
