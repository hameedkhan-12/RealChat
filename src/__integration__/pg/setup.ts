import { beforeAll, vi } from 'vitest'

// Avoid real rate-limit backend and email side effects in integration tests.
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 9 }),
  getClientIp: () => '127.0.0.1',
}))
vi.mock('@/lib/mail', () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }))

/** Required environment for getEnv() validation and real-DB integration tests. */
beforeAll(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_integration')
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_integration')
  vi.stubEnv('PUSHER_SECRET', 'test-pusher-secret')
  vi.stubEnv('PUSHER_KEY', 'test-pusher-key')

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set to run real-PG integration tests')
  }
})
