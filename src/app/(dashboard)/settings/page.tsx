import InfoBar from '@/components/infobar'
import React from 'react'

const Page = () => {
  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0 flex flex-col gap-10">
        <p className="text-muted-foreground">Account settings will be available in a later phase.</p>
      </div>
    </>
  )
}

export default Page