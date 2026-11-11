'use client'
import { Separator } from '@/components/ui/separator'
import { useSettings } from '@/hooks/settings/use-settings'
import React from 'react'
import { DomainUpdate } from './domain-update'
import CodeSnippet from './code-snippet'
import PremiumBadge from '@/icons/premium-badge'
import EditChatbotIcon from './edit-chatbot-icon'
import BotCustomization from './bot-customization'
import BotLivePreview from './bot-preview'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/loader'
import { parseBotConfig } from '@/lib/utils'

const WelcomeMessage = dynamic(
  () => import('./greetings-message').then((props) => props.default),
  {
    ssr: false,
  }
)

type Props = {
  id: string
  name: string
  plan: 'STANDARD' | 'PRO' | 'ULTIMATE'
  chatBot: {
    id: string
    icon: string | null
    welcomeMessage: string | null
    background?: string | null
    textColor?: string | null
  } | null
}

const SettingsForm = ({ id, name, chatBot, plan }: Props) => {
  const {
    register,
    onUpdateSettings,
    errors,
    onDeleteDomain,
    deleting,
    loading,
    setValue,
    watch,
  } = useSettings(id)

  const config = parseBotConfig(chatBot?.textColor, chatBot?.background)

  const currentTheme = watch('background') || config.theme || '#FFA947'
  const currentTextColor = watch('textColor') || config.textColor || '#FFFFFF'
  const currentBotName = watch('botName') !== undefined ? watch('botName') : config.botName
  const currentBranding = watch('branding') !== undefined ? watch('branding') : config.branding
  const currentWelcome = watch('welcomeMessage') || chatBot?.welcomeMessage || ''

  return (
    <form
      className="flex flex-col gap-8 pb-10"
      onSubmit={onUpdateSettings}
    >
      <div className="flex flex-col gap-3">
        <h2 className="font-bold text-2xl">Domain Settings</h2>
        <Separator orientation="horizontal" />
        <DomainUpdate
          name={name}
          register={register}
          errors={errors}
        />
        <CodeSnippet id={id} />
      </div>

      <div className="flex flex-col gap-3 mt-5">
        <div className="flex gap-4 items-center">
          <h2 className="font-bold text-2xl">Chatbot Settings & Branding</h2>
          <div className="flex gap-1 bg-cream dark:bg-muted rounded-full px-3 py-1 text-xs items-center font-bold">
            <PremiumBadge />
            Customizable
          </div>
        </div>
        <Separator orientation="horizontal" />

        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="col-span-1 flex flex-col gap-5 order-last md:order-first">
            <EditChatbotIcon
              chatBot={chatBot}
              register={register}
              errors={errors}
            />
            <WelcomeMessage
              message={chatBot?.welcomeMessage!}
              register={register}
              errors={errors}
            />
            <BotCustomization
              register={register}
              errors={errors}
              setValue={setValue}
              watch={watch}
              initialBackground={config.theme}
              initialTextColor={config.textColor}
              initialBotName={config.botName}
              initialBranding={config.branding}
            />
          </div>

          <div className="col-span-1 sticky top-6 flex justify-center py-4">
            <BotLivePreview
              domainName={name}
              botIcon={chatBot?.icon}
              themeColor={currentTheme}
              textColor={currentTextColor}
              botName={currentBotName}
              branding={currentBranding}
              welcomeMessage={currentWelcome}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-5 justify-end pt-4 border-t">
        <Button
          onClick={onDeleteDomain}
          variant="destructive"
          type="button"
          className="px-10 h-[50px]"
        >
          <Loader loading={deleting}>Delete Domain</Loader>
        </Button>
        <Button
          type="submit"
          className="w-[120px] h-[50px]"
        >
          <Loader loading={loading}>Save</Loader>
        </Button>
      </div>
    </form>
  )
}

export default SettingsForm
