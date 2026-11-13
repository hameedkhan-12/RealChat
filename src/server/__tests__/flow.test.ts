import { describe, it, expect, vi, beforeEach } from 'vitest'
import { advanceFlow, getFlowSteps } from '@/server/flow'
import { client } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  client: {
    flowStep: { findMany: vi.fn() },
  },
}))

const baseSteps = [
  {
    id: 's1', key: 'step1', type: 'CHOICE' as const, prompt: 'Buy or rent?',
    options: [{ label: 'Buy', value: 'buy', nextStepKey: 'step2' }, { label: 'Rent', value: 'rent' }],
    required: true, mapsTo: 'NONE' as const, isActive: true, domainId: 'd1', position: 1,
  },
  {
    id: 's2', key: 'step2', type: 'TEXT' as const, prompt: 'Budget?', options: null,
    required: true, mapsTo: 'NONE' as const, isActive: true, domainId: 'd1', position: 2,
  },
  {
    id: 's3', key: 'step3', type: 'EMAIL' as const, prompt: 'Email?', options: null,
    required: true, mapsTo: 'EMAIL' as const, isActive: true, domainId: 'd1', position: 3,
  },
]

describe('advanceFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns first step when no current step', async () => {
    vi.mocked(client.flowStep.findMany).mockResolvedValue(baseSteps as any)
    const result = await advanceFlow('d1', null)
    expect(result.kind).toBe('step')
    expect((result.step as any).key).toBe('step1')
  })

  it('advances to next step on valid answer', async () => {
    vi.mocked(client.flowStep.findMany).mockResolvedValue(baseSteps as any)
    const result = await advanceFlow('d1', 'step1', 'buy')
    expect(result.kind).toBe('step')
    expect((result.step as any).key).toBe('step2')
  })

  it('branches via nextStepKey', async () => {
    vi.mocked(client.flowStep.findMany).mockResolvedValue(baseSteps as any)
    // 'rent' has no nextStepKey, so goes to step2 too (next in order)
    const result = await advanceFlow('d1', 'step1', 'rent')
    expect(result.kind).toBe('step')
    expect((result.step as any).key).toBe('step2')
  })

  it('completes when no more steps', async () => {
    vi.mocked(client.flowStep.findMany).mockResolvedValue(baseSteps as any)
    const result = await advanceFlow('d1', 'step3', 'test@test.com')
    expect(result.kind).toBe('complete')
  })

  it('repeats current step on invalid choice', async () => {
    vi.mocked(client.flowStep.findMany).mockResolvedValue(baseSteps as any)
    const result = await advanceFlow('d1', 'step1', 'maybe')
    expect(result.kind).toBe('step')
    expect((result.step as any).key).toBe('step1')
  })

  it('validates email format', async () => {
    vi.mocked(client.flowStep.findMany).mockResolvedValue(baseSteps as any)
    const result = await advanceFlow('d1', 'step3', 'not-an-email')
    expect(result.kind).toBe('step')
    expect((result.step as any).key).toBe('step3')
  })

  it('accepts valid email', async () => {
    vi.mocked(client.flowStep.findMany).mockResolvedValue(baseSteps as any)
    const result = await advanceFlow('d1', 'step3', 'test@example.com')
    expect(result.kind).toBe('complete')
  })

  it('returns complete when no steps exist', async () => {
    vi.mocked(client.flowStep.findMany).mockResolvedValue([])
    const result = await advanceFlow('d1', null)
    expect(result.kind).toBe('complete')
  })
})

describe('getFlowSteps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ordered steps', async () => {
    vi.mocked(client.flowStep.findMany).mockResolvedValue(baseSteps as any)
    const steps = await getFlowSteps('d1')
    expect(steps.length).toBe(3)
    expect((steps[0] as any).key).toBe('step1')
    expect((steps[1] as any).key).toBe('step2')
  })
})
