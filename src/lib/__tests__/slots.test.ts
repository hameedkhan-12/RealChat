import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateAvailableSlots, checkSlotConflict } from '@/lib/slots'
import { client } from '@/lib/prisma'

const baseConfig = {
  slotMinutes: 30,
  bufferMinutes: 0,
  minNoticeHours: 2,
  maxDaysAhead: 7,
  timezone: 'UTC',
}

function nextWednesday() {
  const now = new Date()
  const daysUntilWednesday = (3 - now.getDay() + 7) % 7 || 7
  const d = new Date(now.getTime() + daysUntilWednesday * 24 * 60 * 60 * 1000)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

describe('generateAvailableSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns slots for a day with rules', async () => {
    vi.mocked(client.availabilityRule.findMany).mockResolvedValue([
      { id: 'r1', domainId: 'domain-1', weekday: 3, startMinute: 540, endMinute: 1020 }, // Wednesday 9am-5pm UTC
    ])
    vi.mocked(client.availabilityException.findMany).mockResolvedValue([])
    vi.mocked(client.booking.findMany).mockResolvedValue([])

    const wednesday = nextWednesday()
    const from = new Date(wednesday.getTime())
    const to = new Date(wednesday.getTime() + 24 * 60 * 60 * 1000)

    const slots = await generateAvailableSlots('domain-1', baseConfig, from, to)
    expect(slots.length).toBeGreaterThan(0)
    expect(slots[0].available).toBe(true)
  })

  it('respects minNoticeHours', async () => {
    vi.mocked(client.availabilityRule.findMany).mockResolvedValue([
      { id: 'r1', domainId: 'domain-1', weekday: 3, startMinute: 0, endMinute: 1440 },
    ])
    vi.mocked(client.availabilityException.findMany).mockResolvedValue([])
    vi.mocked(client.booking.findMany).mockResolvedValue([])

    const now = new Date()
    const from = new Date(now.getTime() + 30 * 60000)
    const to = new Date(now.getTime() + 2 * 60 * 60000)

    const slots = await generateAvailableSlots('domain-1', { ...baseConfig, minNoticeHours: 2 }, from, to)
    if (slots.length > 0) {
      expect(slots[0].start.getTime()).toBeGreaterThanOrEqual(now.getTime() + 2 * 60 * 60000 - 60000)
    }
  })

  it('excludes closed exception dates', async () => {
    vi.mocked(client.availabilityRule.findMany).mockResolvedValue([
      { id: 'r1', domainId: 'domain-1', weekday: 3, startMinute: 540, endMinute: 600 },
    ])
    const wednesday = nextWednesday()
    wednesday.setUTCHours(0, 0, 0, 0)
    vi.mocked(client.availabilityException.findMany).mockResolvedValue([
      { id: 'e1', domainId: 'domain-1', date: new Date(wednesday.getTime()), closed: true },
    ])
    vi.mocked(client.booking.findMany).mockResolvedValue([])

    const from = new Date(wednesday.getTime())
    const to = new Date(wednesday.getTime() + 24 * 60 * 60 * 1000)

    const slots = await generateAvailableSlots('domain-1', baseConfig, from, to)
    expect(slots.length).toBe(0)
  })
})

describe('checkSlotConflict', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when conflict exists', async () => {
    vi.mocked(client.booking.findFirst).mockResolvedValue({
      id: 'b-1',
      domainId: 'domain-1',
      customerId: null,
      assignedToUserId: null,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 3600000),
      status: 'CONFIRMED',
      manageTokenHash: null,
      email: 'test@test.com',
      name: 'Test Customer',
      notes: null,
      phone: null,
      visitorTimezone: null,
      cancelledAt: null,
      reminder24hSentAt: null,
      reminder1hSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const result = await checkSlotConflict('domain-1', new Date(), new Date(Date.now() + 3600000))
    expect(result).toBe(true)
  })

  it('returns false when no conflict', async () => {
    vi.mocked(client.booking.findFirst).mockResolvedValue(null)
    const result = await checkSlotConflict('domain-1', new Date(), new Date(Date.now() + 3600000))
    expect(result).toBe(false)
  })
})
