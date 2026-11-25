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
    include: ['src/__integration__/pg/**/*.pg.test.ts'],
    passWithNoTests: true,
    testTimeout: 60000,
    hookTimeout: 60000,
    setupFiles: ['./src/__integration__/pg/setup.ts'],
    environment: 'node',
  },
})
