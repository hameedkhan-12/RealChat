'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { onOwnerSendMessage } from '@/actions/conversation'
import React, { useState } from 'react'

type Props = {
  conversationId: string
  domainId: string
  disabled?: boolean
}

export function MessageComposer({
  conversationId,
  domainId,
  disabled = false,
}: Props) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await onOwnerSendMessage(domainId, conversationId, content.trim())
      if (res?.ok) {
        setContent('')
      } else {
        setError(res?.error || 'Failed to send message')
      }
    } catch {
      setError('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="border-t p-3 bg-muted/50 flex items-center gap-2">
      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type your reply as agent..."
        disabled={disabled || sending}
        className="flex-1 px-3 py-1.5 rounded border text-sm focus:ring-2 focus:ring-blue-500 outline-none"
      />
      <Button
        type="submit"
        disabled={disabled || sending || !content.trim()}
        className="px-4 py-1.5 text-sm"
      >
        {sending ? 'Sending...' : 'Send'}
      </Button>
      {error && (
        <span className="text-xs text-destructive ml-2">{error}</span>
      )}
    </form>
  )
}
