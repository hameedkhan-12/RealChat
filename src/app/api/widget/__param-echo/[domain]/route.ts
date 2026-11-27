import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params
  return NextResponse.json({
    raw: domain,
    codes: [...domain].map((c) => c.charCodeAt(0)),
    length: domain.length,
  })
}
