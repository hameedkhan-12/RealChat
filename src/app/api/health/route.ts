import { NextResponse } from 'next/server'
import { getEnv } from '@/env'

export const runtime = 'nodejs'

export const GET = async (): Promise<NextResponse> => {
  const env = getEnv()
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    service: 'realchat',
  })
}
