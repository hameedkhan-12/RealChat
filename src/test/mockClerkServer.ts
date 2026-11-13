// Mock for @clerk/nextjs/server in client-side tests
import { vi } from 'vitest'

export const currentUser = vi.fn(() => Promise.resolve(null))
export const clerkClient = vi.fn(() => Promise.resolve({ users: { updateUser: vi.fn() } }))
export const auth = vi.fn(() => Promise.resolve({ userId: null, sessionId: null, getToken: vi.fn(() => Promise.resolve(null)) }))
