'use client'

import React from 'react'

type Props = {
  publicKey?: string
  pageUrl?: string
  utm?: Record<string, string>
  lang?: 'en' | 'ar'
}

export default function ChatWidget({ publicKey, pageUrl, utm, lang }: Props) {
  return (
    <div className="w-full h-full bg-transparent overflow-hidden flex items-center justify-center">
      <div className="text-xs text-neutral-400">RealChat widget loading…</div>
    </div>
  )
}
