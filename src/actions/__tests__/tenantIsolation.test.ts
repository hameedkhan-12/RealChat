import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => {
  const mockClient: any = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    domain: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    domainMember: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    chatRoom: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    chatMessage: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    customer: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    customerResponses: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
    flowStep: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    helpDesk: { findMany: vi.fn(), create: vi.fn() },
    filterQuestions: { findMany: vi.fn(), create: vi.fn() },
    availabilityRule: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    availabilityException: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(async (cb) => cb({})),
  }
  return { client: mockClient }
})

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(() => Promise.resolve(null)),
  clerkClient: vi.fn(() => Promise.resolve({ users: { updateUser: vi.fn() } })),
}))

import { client } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'
import { onGetAllAccountDomains } from '@/actions/settings'
import { onGetDomainChatRooms } from '@/actions/conversation'
import { onGetAllDomainBookings } from '@/actions/appointment'

describe('tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(client.user.findUnique as any).mockResolvedValue({
      id: 'user-1',
      memberships: [{ domain: { name: 'Domain A', id: 'domain-a', icon: '', customers: [] } }],
    })
    ;(currentUser as any).mockResolvedValue({ id: 'user-1', email: 'test@test.com' })
  })

  describe('domain access requires membership', () => {
    it('onGetDomainChatRooms requires domain membership', async () => {
      ;(client.chatRoom.findUnique as any).mockResolvedValue({ id: 'domain-2', domainId: 'domain-2' })
      ;(client.domainMember.findUnique as any).mockResolvedValue(null)

      await expect(onGetDomainChatRooms('domain-2')).rejects.toThrow('FORBIDDEN')

      expect(client.domainMember.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            domainId_userId: expect.objectContaining({
              domainId: 'domain-2',
              userId: 'user-1',
            }),
          }),
        })
      )
    })
  })

  describe('chatRoom access is tenant-scoped', () => {
    it('onGetChatMessages only returns messages for authorized domain', async () => {
      const mockRoom = {
        id: 'room-1',
        domainId: 'domain-1',
        status: 'BOT',
        messages: [{ id: 'm1', senderType: 'VISITOR', message: 'hi', createdAt: new Date(), seen: false }],
      }
      ;(client.chatRoom.findUnique as any).mockResolvedValue(mockRoom)
      ;(client.domainMember.findUnique as any).mockResolvedValue({ id: 'm-1', domainId: 'domain-1', userId: 'user-1', role: 'OWNER' })

      const { onGetChatMessages } = await import('@/actions/conversation')
      const result = await onGetChatMessages('room-1')
      expect(result?.ok).toBe(true)
    })
  })

  describe('booking access is tenant-scoped', () => {
    it('onGetAllDomainBookings only returns bookings for domain', async () => {
      ;(client.domainMember.findUnique as any).mockResolvedValue({ id: 'm-1', domainId: 'domain-1', userId: 'user-1', role: 'OWNER' })
      ;(client.booking.findMany as any).mockResolvedValue([])

      const result = await onGetAllDomainBookings('domain-1')
      expect(result?.ok).toBe(true)

      expect(client.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ domainId: 'domain-1' }),
        })
      )
    })
  })

  describe('cross-tenant access is rejected', () => {
    it('onGetAllAccountDomains only returns user domains', async () => {
      ;(client.user.findUnique as any).mockResolvedValue({
        id: 'user-1',
        memberships: [{ domain: { name: 'Domain A', id: 'domain-a', icon: '', customers: [] } }],
      })

      const result = await onGetAllAccountDomains()
      expect(result?.domains.length).toBe(1)
      expect(result?.domains[0].id).toBe('domain-a')
    })
  })
})
