import 'server-only'
import { client } from '@/lib/prisma'

export type StepType = 'CHOICE' | 'MULTI_CHOICE' | 'TEXT' | 'NUMBER' | 'EMAIL' | 'PHONE'

export type FlowStep = {
  id: string
  key: string
  type: StepType
  prompt: string
  options: { label: string; value: string; nextStepKey?: string }[] | null
  required: boolean
  mapsTo: 'NONE' | 'NAME' | 'EMAIL' | 'PHONE'
}

export type FlowAnswer = string | string[] | null | undefined

export type FlowResult =
  | { kind: 'step'; step: FlowStep }
  | { kind: 'complete'; step?: FlowStep }

function normalizeStep(s: any): FlowStep {
  return {
    id: s.id,
    key: s.key,
    type: s.type as StepType,
    prompt: s.prompt,
    options: Array.isArray(s.options) ? (s.options as { label: string; value: string; nextStepKey?: string }[]) : null,
    required: s.required,
    mapsTo: s.mapsTo as 'NONE' | 'NAME' | 'EMAIL' | 'PHONE',
  }
}

function isValidAnswer(type: StepType, answer: FlowAnswer, options: { value: string }[] | null): boolean {
  if (answer === undefined || answer === null) return true // absence handled by required check
  const values = Array.isArray(answer) ? answer : [String(answer)]
  switch (type) {
    case 'CHOICE':
      return values.length === 1 && !!options && options.some((o) => o.value === values[0])
    case 'MULTI_CHOICE':
      return (
        values.length > 0 &&
        !!options &&
        values.every((v) => options.some((o) => o.value === v))
      )
    case 'EMAIL': {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return values.every((v) => re.test(v))
    }
    case 'PHONE': {
      const re = /^\+?\d[\d\s().-]{6,}\d$/
      return values.every((v) => re.test(v))
    }
    case 'NUMBER': {
      const re = /^-?\d+(\.\d+)?$/
      return values.every((v) => re.test(v))
    }
    case 'TEXT':
      return values.every((v) => v.length > 0)
  }
}

/**
 * Pure flow engine. State source of truth is room.currentStepKey (DB), never the client.
 * Validates the answer against the current step; only saves/advances on valid input.
 * Optional steps with no answer are skipped.
 */
export async function advanceFlow(
  domainId: string,
  currentStepKey: string | null,
  answer?: FlowAnswer
): Promise<FlowResult> {
  const steps = await client.flowStep.findMany({
    where: { domainId, isActive: true },
    orderBy: { position: 'asc' },
    select: { id: true, key: true, type: true, prompt: true, options: true, required: true, mapsTo: true },
  })

  if (steps.length === 0) return { kind: 'complete' }

  const normalized = steps.map(normalizeStep)

  // No current step -> start at first step
  if (!currentStepKey) {
    return { kind: 'step', step: normalized[0] }
  }

  const currentIndex = normalized.findIndex((s) => s.key === currentStepKey)
  if (currentIndex === -1) return { kind: 'step', step: normalized[0] }

  const current = normalized[currentIndex]

  // Absence of answer: optional steps are skipped; required steps stay
  if (answer === undefined || answer === null) {
    if (!current.required) {
      const nextKey = normalized[currentIndex + 1]?.key ?? null
      if (!nextKey) return { kind: 'complete' }
      const nextStep = normalized.find((s) => s.key === nextKey)
      return nextStep ? { kind: 'step', step: nextStep } : { kind: 'complete' }
    }
    return { kind: 'step', step: current }
  }

  // Validate the provided answer
  if (!isValidAnswer(current.type, answer, current.options)) {
    return { kind: 'step', step: current }
  }

  // Determine next step
  let nextKey: string | null = null
  if (current.type === 'CHOICE' && current.options) {
    const matched = current.options.find((o) => o.value === String(answer))
    nextKey = matched?.nextStepKey ?? normalized[currentIndex + 1]?.key ?? null
  } else {
    nextKey = normalized[currentIndex + 1]?.key ?? null
  }

  if (!nextKey) return { kind: 'complete' }
  const nextStep = normalized.find((s) => s.key === nextKey)
  return nextStep ? { kind: 'step', step: nextStep } : { kind: 'complete' }
}

export async function getFlowSteps(domainId: string): Promise<FlowStep[]> {
  const steps = await client.flowStep.findMany({
    where: { domainId, isActive: true },
    orderBy: { position: 'asc' },
    select: { id: true, key: true, type: true, prompt: true, options: true, required: true, mapsTo: true },
  })
  return steps.map(normalizeStep)
}
