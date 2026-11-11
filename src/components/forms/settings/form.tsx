'use client'
import { Separator } from '@/components/ui/separator'
import { useSettings } from '@/hooks/settings/use-settings'
import React from 'react'
import { DomainUpdate } from './domain-update'
import CodeSnippet from './code-snippet'
import EditChatbotIcon from './edit-chatbot-icon'
import BotCustomization from './bot-customization'
import BotLivePreview from './bot-preview'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/loader'

const WelcomeMessage = dynamic(() => import('./greetings-message').then((m) => m.default), { ssr: false })

type Props = {
  id: string
  name: string
  plan?: string
  chatBot: {
    id: string
    icon?: string | null
    avatarUrl?: string | null
    welcomeMessage: string | null
    background?: string | null
    primaryColor?: string | null
    textColor?: string | null
  } | null
}

const SettingsForm = ({ id, name, chatBot }: Props) => {
  const { register, onUpdateSettings, errors, onDeleteDomain, deleting, loading, setValue, watch } = useSettings(id)
  const icon = chatBot?.icon ?? chatBot?.avatarUrl ?? null
  const theme = chatBot?.background ?? chatBot?.primaryColor ?? '#FFFFFF'
  const text = chatBot?.textColor ?? '#000000'
  const currentTheme = watch('background') || theme
  const currentTextColor = watch('textColor') || text
  const currentWelcome = watch('welcomeMessage') || chatBot?.welcomeMessage || ''

  return (
    <form className="flex flex-col gap-8 pb-10" onSubmit={onUpdateSettings}>
      <div className="flex flex-col gap-3">
        <h2 className="font-bold text-2xl">Domain Settings</h2>
        <Separator orientation="horizontal" />
        <DomainUpdate name={name} register={register} errors={errors} />
        <CodeSnippet id={id} />
      </div>
      <div className="flex flex-col gap-3 mt-5">
        <h2 className="font-bold text-2xl">Chatbot Settings</h2>
        <Separator orientation="horizontal" />
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="col-span-1 flex flex-col gap-5 order-last md:order-first">
            <EditChatbotIcon chatBot={chatBot as any} register={register} errors={errors} />
            <WelcomeMessage message={chatBot?.welcomeMessage!} register={register} errors={errors} />
            <BotCustomization register={register} errors={errors} setValue={setValue} watch={watch} initialBackground={theme} initialTextColor={text} />
          </div>
          <div className="col-span-1 sticky top-6 flex justify-center py-4">
            <BotLivePreview domainName={name} botIcon={icon} themeColor={currentTheme} textColor={currentTextColor} welcomeMessage={currentWelcome} />
          </div>
        </div>
      </div>
      <div className="flex gap-5 justify-end pt-4 border-t">
        <Button onClick={onDeleteDomain} variant="destructive" type="button" className="px-10 h-[50px]"><Loader loading={deleting}>Delete Domain</Loader></Button>
        <Button type="submit" className="w-[120px] h-[50px]"><Loader loading={loading}>Save</Loader></Button>
      </div>
    </form>
  )
}

export default SettingsForm