'use server'

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

export type FlowResult =
  | { kind: 'step'; step: FlowStep }
  | { kind: 'complete'; step?: FlowStep }

/**
 * Pure flow engine.
 * Given the domain's active ordered steps, the session's currentStepKey and an optional answer,
 * validate the answer against the current step and return the next step or completion.
 * Never trusts client-sent history; state is authoritative in the DB.
 */
export async function advanceFlow(
  domainId: string,
  currentStepKey: string | null,
  answer?: string
): Promise<FlowResult> {
  const steps = await client.flowStep.findMany({
    where: { domainId, isActive: true },
    orderBy: { position: 'asc' },
    select: { id: true, key: true, type: true, prompt: true, options: true, required: true, mapsTo: true },
  })

  if (steps.length === 0) {
    return { kind: 'complete' }
  }

  // Normalize options from JSON
  const normalized: FlowStep[] = steps.map((s) => ({
    id: s.id,
    key: s.key,
    type: s.type as StepType,
    prompt: s.prompt,
    options: Array.isArray(s.options) ? (s.options as { label: string; value: string; nextStepKey?: string }[]) : null,
    required: s.required,
    mapsTo: s.mapsTo as 'NONE' | 'NAME' | 'EMAIL' | 'PHONE',
  }))

  // No current step -> start at first step
  if (!currentStepKey) {
    const first = normalized[0]
    return { kind: 'step', step: first }
  }

  const currentIndex = normalized.findIndex((s) => s.key === currentStepKey)
  if (currentIndex === -1) {
    // Invalid key, restart at first
    return { kind: 'step', step: normalized[0] }
  }

  const current = normalized[currentIndex]

  const trimmed = answer !== undefined && answer !== null ? String(answer).trim() : ''

  // If there is an answer, validate it
  if (answer !== undefined && answer !== null) {
    // Required check
    if (current.required && trimmed.length === 0) {
      return { kind: 'step', step: current }
    }

    // Type-specific validation
    switch (current.type) {
      case 'CHOICE':
      case 'MULTI_CHOICE': {
        if (!current.options || current.options.length === 0) {
          return { kind: 'step', step: current }
        }
        const validValues = current.options.map((o) => o.value)
        if (!validValues.includes(trimmed)) {
          return { kind: 'step', step: current } // keep step; UI shows "Please choose an option"
        }
        break
      }
      case 'EMAIL': {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRe.test(trimmed)) return { kind: 'step', step: current }
        break
      }
      case 'PHONE': {
        const phoneRe = /^\+?\d[\d\s().-]{6,}\d$/
        if (!phoneRe.test(trimmed)) return { kind: 'step', step: current }
        break
      }
      case 'NUMBER': {
        if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return { kind: 'step', step: current }
        break
      }
      case 'TEXT': {
        // any non-empty text is fine when required; otherwise any string ok
        if (current.required && trimmed.length === 0) return { kind: 'step', step: current }
        break
      }
    }
  }

  // Determine next step
  let nextKey: string | null = null

  // If answering a choice with an explicit nextStepKey, branch there
  if (trimmed && current.options) {
    const matched = current.options.find((o) => o.value === trimmed)
    if (matched?.nextStepKey) {
      nextKey = matched.nextStepKey
    } else {
      // default: move to next step in order
      nextKey = normalized[currentIndex + 1]?.key ?? null
    }
  } else {
    nextKey = normalized[currentIndex + 1]?.key ?? null
  }

  if (!nextKey) {
    return { kind: 'complete' }
  }

  const nextStep = normalized.find((s) => s.key === nextKey)
  if (!nextStep) return { kind: 'complete' }
  return { kind: 'step', step: nextStep }
}

export async function getFlowSteps(domainId: string): Promise<FlowStep[]> {
  const steps = await client.flowStep.findMany({
    where: { domainId, isActive: true },
    orderBy: { position: 'asc' },
    select: { id: true, key: true, type: true, prompt: true, options: true, required: true, mapsTo: true },
  })
  return steps.map((s) => ({
    id: s.id,
    key: s.key,
    type: s.type as StepType,
    prompt: s.prompt,
    options: Array.isArray(s.options) ? (s.options as { label: string; value: string; nextStepKey?: string }[]) : null,
    required: s.required,
    mapsTo: s.mapsTo as 'NONE' | 'NAME' | 'EMAIL' | 'PHONE',
  }))
}
