import 'server-only'
import Pusher from 'pusher'

let _pusher: Pusher | null = null

export function getPusherServer() {
  if (_pusher) return _pusher
  const appId = process.env.PUSHER_APP_ID
  const key = process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY
  const secret = process.env.PUSHER_SECRET
  const cluster = process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  if (!appId || !key || !secret || !cluster) return null
  _pusher = new Pusher({ appId, key, secret, cluster, useTLS: true })
  return _pusher
}

export function roomChannel(roomId: string) {
  return `private-room-${roomId}`
}

export function domainChannel(domainId: string) {
  return `private-domain-${domainId}`
}
