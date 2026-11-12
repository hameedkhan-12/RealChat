'use client'
import { useToast } from '@/components/ui/use-toast'
import { usePathname, useRouter } from 'next/navigation'
import React from 'react'
import { useEffect, useState } from 'react'
import { useChatContext } from './user-chat-context'
import { onGetConversationMode, onToggleRealtime } from '@/actions/conversation'
import { useClerk } from '@clerk/nextjs'

const useSideBar = () => {
  const [expand, setExpand] = useState<boolean>(false)
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [realtime, setRealtime] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)

const { chatRoom } = useChatContext()

function okMessage(res: any): string | null {
  return res && res.ok && typeof res.data === 'object' ? String((res.data as any).message ?? '') : null
}

const okChatRoom = (res: any) => res && res.ok && typeof res.data === 'object' ? (res.data as any).chatRoom : null

const onActivateRealtime = async (e: any) => {
  try {
    const realtime = await onToggleRealtime(
      chatRoom!,
      e.target.ariaChecked == 'true' ? false : true
    )
    if (realtime?.ok) {
      const cr = okChatRoom(realtime)
      setRealtime(!!(cr?.live))
      toast({
        title: 'Success',
        description: okMessage(realtime),
      })
    }
  } catch (error) {
    console.log(error)
  }
}

const onGetCurrentMode = async () => {
  setLoading(true)
  const mode = await onGetConversationMode(chatRoom!)
  if (mode) {
    setRealtime(!!mode?.live)
    setLoading(false)
  }
}

  useEffect(() => {
    if (chatRoom) {
      onGetCurrentMode()
    }
  }, [chatRoom])

  const page = pathname.split('/').pop()
  const { signOut } = useClerk()

  const onSignOut = () => signOut(() => router.push('/'))

  const onExpand = () => setExpand((prev) => !prev)

  return {
    expand,
    onExpand,
    page,
    onSignOut,
    realtime,
    onActivateRealtime,
    chatRoom,
    loading,
  }
}

export default useSideBar
