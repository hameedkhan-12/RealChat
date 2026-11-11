import React from 'react'

export default function ChatbotLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full h-full bg-transparent overflow-hidden">
      {children}
    </div>
  )
}

