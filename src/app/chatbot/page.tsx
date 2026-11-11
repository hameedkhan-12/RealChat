import AiChatBot from '@/components/chatbot'
import React from 'react'

type Props = {}

const ChatBot = (props: Props) => {
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
      <AiChatBot />
    </div>
  )
}

export default ChatBot
