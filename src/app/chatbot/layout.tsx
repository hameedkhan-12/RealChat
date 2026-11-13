import React from 'react'

export default function ChatbotLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full h-full bg-transparent overflow-hidden">
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
      {children}
    </div>
  )
}
