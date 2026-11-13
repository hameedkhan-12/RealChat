import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { readJson, handle } from '@/lib/http'
import { HttpError, AuthError } from '@/lib/errors'

async function makeRequest(body: string, contentType = 'application/json'): Promise<Request> {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  })
}

describe('readJson', () => {
  it('rejects non-JSON content type with 415', async () => {
    const req = await makeRequest('{}', 'text/plain')
    await expect(readJson(req, z.object({}))).rejects.toMatchObject({
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    })
  })

  it('rejects oversized body with 413', async () => {
    const big = 'x'.repeat(20000)
    const req = await makeRequest(big)
    await expect(readJson(req, z.object({}), 100)).rejects.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    })
  })

  it('rejects bad JSON with 400', async () => {
    const req = await makeRequest('{not json')
    await expect(readJson(req, z.object({}))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_JSON',
    })
  })

  it('rejects schema failure with 400 and issues', async () => {
    const schema = z.object({ n: z.coerce.number() })
    const req = await makeRequest(JSON.stringify({ n: 'not-a-number' }))
    await expect(readJson(req, schema)).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
    })
  })

  it('returns parsed data on success', async () => {
    const schema = z.object({ n: z.coerce.number() })
    const req = await makeRequest(JSON.stringify({ n: '5' }))
    const data = await readJson(req, schema)
    expect(data.n).toBe(5)
  })
})

describe('handle', () => {
  it('maps HttpError to status + code without stack', async () => {
    const fn = handle(async () => {
      throw new HttpError(403, 'FORBIDDEN')
    })
    const res = await fn(new Request('http://localhost/test'))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json).toMatchObject({ ok: false, error: 'FORBIDDEN' })
    expect(json.stack).toBeUndefined()
  })

  it('maps AuthError to status + code', async () => {
    const fn = handle(async () => {
      throw new AuthError('UNAUTHORIZED')
    })
    const res = await fn(new Request('http://localhost/test'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toMatchObject({ ok: false, error: 'UNAUTHORIZED' })
  })

  it('maps unknown errors to 500 INTERNAL without stack', async () => {
    const fn = handle(async () => {
      throw new Error('boom')
    })
    const res = await fn(new Request('http://localhost/test'))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json).toMatchObject({ ok: false, error: 'INTERNAL' })
    expect(json.stack).toBeUndefined()
  })
})
