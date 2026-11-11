'use client'
import { useChatWindow } from '@/hooks/conversation/use-conversation'
import React from 'react'
import { Loader } from '../loader'
import Bubble from '../chatbot/bubble'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { PaperclipIcon, Radio, BotIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {}

const Messenger = (props: Props) => {
  const {
    messageWindowRef,
    chats,
    loading,
    chatRoom,
    onHandleSentMessage,
    register,
    liveMode,
    liveLoading,
    onToggleLiveMode,
  } = useChatWindow()

  return (
    <div className="flex-1 flex flex-col h-0 relative">
      {/* Live mode status banner */}
      {chatRoom && (
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2 text-sm font-medium border-b transition-colors',
            liveMode
              ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-muted border-border text-muted-foreground'
          )}
        >
          <div className="flex items-center gap-2">
            {liveMode ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                <span>🟢 Live — You are responding as a human agent</span>
              </>
            ) : (
              <>
                <BotIcon className="h-3.5 w-3.5" />
                <span>AI Mode — bot is handling this conversation</span>
              </>
            )}
          </div>
          <Button
            size="sm"
            variant={liveMode ? 'destructive' : 'default'}
            className="h-7 text-xs gap-1.5"
            onClick={onToggleLiveMode}
            disabled={liveLoading}
          >
            <Radio className="h-3 w-3" />
            {liveLoading
              ? 'Switching...'
              : liveMode
              ? 'Return to AI'
              : 'Take Over (Go Live)'}
          </Button>
        </div>
      )}

      <div className="flex-1 h-0 w-full flex flex-col">
        <Loader loading={loading}>
          <div
            ref={messageWindowRef}
            className="w-full flex-1 h-0 flex flex-col gap-3 pl-5 py-5 chat-window overflow-y-auto"
          >
            {chats.length ? (
              chats.map((chat) => (
                <Bubble
                  key={chat.id}
                  message={{
                    role: chat.role!,
                    content: chat.message,
                  }}
                  createdAt={chat.createdAt}
                />
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {chatRoom ? 'No messages yet' : 'Select a conversation to start'}
              </div>
            )}
          </div>
        </Loader>
      </div>

      <form
        onSubmit={onHandleSentMessage}
        className="flex px-3 pt-3 pb-10 flex-col backdrop-blur-sm bg-muted w-full"
      >
        <div className="flex justify-between">
          <Input
            {...register('content')}
            placeholder={
              liveMode
                ? 'Type your reply as human agent...'
                : 'Type your reply (sending automatically takes over live)...'
            }
            className="focus-visible:ring-0 flex-1 p-0 focus-visible:ring-offset-0 bg-muted rounded-none outline-none border-none"
          />
          <Button
            type="submit"
            className="mt-3 px-7"
            disabled={!chatRoom}
          >
            Send
          </Button>
        </div>
        <span>
          <PaperclipIcon className="text-muted-foreground" />
        </span>
      </form>
    </div>
  )
}

export default Messenger
