import 'server-only'
import { getEnv } from '@/env'

// Pusher ships CommonJS with no bundled types; require it directly.
const Pusher = require('pusher')

let _pusher: any = null

export function getPusherServer(): any | null {
  const env = getEnv()
  if (!_pusher) {
    if (!env.PUSHER_APP_ID || !env.PUSHER_KEY || !env.PUSHER_SECRET || !env.PUSHER_CLUSTER) return null
    _pusher = new Pusher({
      appId: env.PUSHER_APP_ID,
      key: env.PUSHER_KEY,
      secret: env.PUSHER_SECRET,
      cluster: env.PUSHER_CLUSTER,
      useTLS: true,
    })
  }
  return _pusher
}

export function roomChannel(roomId: string) {
  return `private-room-${roomId}`
}

export function domainChannel(domainId: string) {
  return `private-domain-${domainId}`
}

/** Compute the Pusher private-channel auth signature: HMAC_SHA256(secret, "socketId:channelName"). */
export function pusherAuthSignature(secret: string, socketId: string, channelName: string): string {
  const crypto = require('crypto')
  return crypto.createHmac('sha256', secret).update(`${socketId}:${channelName}`).digest('hex')
}
