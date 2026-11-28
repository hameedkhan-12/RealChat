import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { client } from '@/lib/prisma'
import { GET as getMessages } from '@/app/api/widget/messages/route'
import { POST as createSession } from '@/app/api/widget/session/route'
import { uid, seedDomain, cleanup } from './seed'

describe('widget session (real PostgreSQL)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
  })

  afterEach(async () => {
    await cleanup()
    vi.unstubAllEnvs()
  })

  it('persists attribution and derives the tenant from the public key', async () => {
    const domain = await seedDomain({ publicKey: uid().replace(/-/g, '') })

    const res = await createSession(
      new Request('http://localhost/api/widget/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: domain.publicKey,
          pageUrl: 'https://example.com/pricing',
          utm: { utm_source: 'google', utm_campaign: 'spring' },
          locale: 'ar',
          domainId: 'attacker-domain',
          customerId: 'attacker-customer',
        }),
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()

    const room = await client.chatRoom.findUnique({ where: { id: json.chatRoomId } })
    expect(room?.domainId).toBe(domain.id)
    expect(room?.pageUrl).toBe('https://example.com/pricing')
    expect(room?.utm).toEqual({ utm_source: 'google', utm_campaign: 'spring' })
    expect(room?.locale).toBe('ar')

    const customer = await client.customer.findUnique({ where: { id: room!.customerId } })
    expect(customer?.domainId).toBe(domain.id)
  })

  it('rejects invalid attribution without creating a room', async () => {
    const domain = await seedDomain({ publicKey: uid().replace(/-/g, '') })
    const before = await client.chatRoom.count({ where: { domainId: domain.id } })

    const res = await createSession(
      new Request('http://localhost/api/widget/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: domain.publicKey, pageUrl: 'javascript:alert(1)' }),
      })
    )
    expect(res.status).toBe(400)

    const after = await client.chatRoom.count({ where: { domainId: domain.id } })
    expect(after).toBe(before)
  })

  it('restores a valid session and reports consent state', async () => {
    const domain = await seedDomain({ publicKey: uid().replace(/-/g, '') })

    const created = await createSession(
      new Request('http://localhost/api/widget/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: domain.publicKey }),
      })
    )
    const json = await created.json()

    const restored = await getMessages(
      new Request('http://localhost/api/widget/messages', {
        headers: { Authorization: `Bearer ${json.sessionToken}` },
      })
    )
    expect(restored.status).toBe(200)
    const restoredJson = await restored.json()
    expect(restoredJson.chatRoomId).toBe(json.chatRoomId)
    expect(restoredJson.consentGiven).toBe(false)

    await client.chatRoom.update({
      where: { id: json.chatRoomId },
      data: { consentAt: new Date() },
    })

    const restoredAgain = await getMessages(
      new Request('http://localhost/api/widget/messages', {
        headers: { Authorization: `Bearer ${json.sessionToken}` },
      })
    )
    const againJson = await restoredAgain.json()
    expect(againJson.consentGiven).toBe(true)
  })

  it('rejects an invalid restored token', async () => {
    const res = await getMessages(
      new Request('http://localhost/api/widget/messages', {
        headers: { Authorization: 'Bearer definitely-not-a-token' },
      })
    )
    expect(res.status).toBe(401)
  })
})
