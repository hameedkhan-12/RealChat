import { vi, beforeAll, afterAll } from 'vitest'

// Mock console to reduce noise in tests
const originalConsole = console.log
beforeAll(() => {
  console.log = vi.fn()
})
afterAll(() => {
  console.log = originalConsole
})
