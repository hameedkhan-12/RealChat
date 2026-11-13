import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { client } from '@/lib/prisma'

function makeRequest(url: string): Request {
  return new Request(url)
}

describe('frame-policy route', () => {
  beforeEach(() => {
    vi.mocked(client.domain.findUnique).mockReset()
  })

  it('returns allowedOrigins for a valid key', async () => {
    vi.mocked(client.domain.findUnique).mockResolvedValue({ allowedOrigins: ['https://example.com', 'https://shop.example.com'] } as any)
    const res = await GET(makeRequest('http://localhost/api/widget/frame-policy?key=abcdef1234567890abcdef1234567890abcdef12'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ ancestors: ['https://example.com', 'https://shop.example.com'] })
  })

  it('returns [] for an unknown key', async () => {
    vi.mocked(client.domain.findUnique).mockResolvedValue(null)
    const res = await GET(makeRequest('http://localhost/api/widget/frame-policy?key=abcdef1234567890abcdef1234567890abcdef12'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ ancestors: [] })
  })

  it('returns [] for a malformed key without calling db', async () => {
    const res = await GET(makeRequest('http://localhost/api/widget/frame-policy?key=not-a-valid-key'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ ancestors: [] })
    expect(client.domain.findUnique).not.toHaveBeenCalled()
  })

  it('returns [] when key is missing', async () => {
    const res = await GET(makeRequest('http://localhost/api/widget/frame-policy'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ ancestors: [] })
  })
})
