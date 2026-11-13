// Mock Prisma client for tests
import { vi, beforeEach } from 'vitest'

export const client = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  domain: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  domainMember: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  chatRoom: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  chatMessage: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  customer: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  customerResponses: {
    create: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  booking: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    $transaction: vi.fn(),
  },
  flowStep: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  helpDesk: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  filterQuestions: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  availabilityRule: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  availabilityException: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  knowledgeItem: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(async (cb) => cb(client)),
}

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})