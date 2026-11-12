import AiChatBot from '@/components/chatbot'
import React from 'react'

const ChatBot = async ({ searchParams }: { searchParams: { [key: string]: string } }) => {
  return (
    <div className="bg-transparent w-full h-full overflow-hidden select-none">
      <style>{`
        :root, html, body {
          background: transparent !important;
          background-color: transparent !important;
          color-scheme: light !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .dark {
          background: transparent !important;
          background-color: transparent !important;
        }
        #__next, main, div[data-nextjs-scroll-focus-boundary] {
          background: transparent !important;
          background-color: transparent !important;
        }
      `}</style>
      <AiChatBot publicKey={searchParams.key} />
    </div>
  )
}

export default ChatBot
