import Section from '@/components/section-label'
import React from 'react'
import { FieldErrors, FieldValues, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Palette, Sparkles, Tag, AlertTriangle } from 'lucide-react'
import { passesWCAGAA } from '@/lib/contrast'

type Props = {
  register: UseFormRegister<FieldValues>
  errors: FieldErrors<FieldValues>
  setValue: UseFormSetValue<FieldValues>
  watch: UseFormWatch<FieldValues>
  initialBackground?: string | null
  initialTextColor?: string | null
  initialBotName?: string
  initialBranding?: string
}

const PRESET_THEMES = [
  { name: 'Warm Orange', color: '#FFA947' },
  { name: 'Ocean Blue', color: '#2563EB' },
  { name: 'Emerald', color: '#059669' },
  { name: 'Royal Violet', color: '#7C3AED' },
  { name: 'Crimson Rose', color: '#E11D48' },
  { name: 'Midnight', color: '#18181B' },
]

const BotCustomization = ({
  register,
  errors,
  setValue,
  watch,
  initialBackground,
  initialTextColor,
  initialBotName,
  initialBranding,
}: Props) => {
  const currentBackground = watch('background') || initialBackground || '#FFA947'
  const currentTextColor = watch('textColor') || initialTextColor || '#FFFFFF'
  const contrastOk = passesWCAGAA(currentBackground, currentTextColor, false)

  return (
    <div className="flex flex-col gap-6 pt-3">
      <Section
        label="Chatbot Branding & Persona"
        message="Personalize your bot's identity, branding banner, and theme"
      />

      <div className="flex flex-col gap-4 lg:w-[500px]">
        {/* Bot Name */}
        <div className="flex flex-col gap-2">
          <Label className="flex items-center gap-2 font-semibold">
            <Sparkles className="w-4 h-4 text-orange" />
            Assistant Name / Title
          </Label>
          <Input
            {...register('botName')}
            placeholder={initialBotName || 'e.g. Sales Rep - Acme Corp'}
            defaultValue={initialBotName}
            className="border-input bg-background"
          />
          <p className="text-xs text-muted-foreground">
            Appears at the top of the chat widget window
          </p>
        </div>

        {/* Custom Branding Footer */}
        <div className="flex flex-col gap-2">
          <Label className="flex items-center gap-2 font-semibold">
            <Tag className="w-4 h-4 text-orange" />
            Custom Footer Branding
          </Label>
          <Input
            {...register('branding')}
            placeholder={initialBranding || 'e.g. Powered by Acme AI'}
            defaultValue={initialBranding}
            className="border-input bg-background"
          />
          <p className="text-xs text-muted-foreground">
            Replaces the default branding text in the widget footer
          </p>
        </div>

        {/* Theme Color Picker */}
        <div className="flex flex-col gap-3 pt-2">
          <Label className="flex items-center gap-2 font-semibold">
            <Palette className="w-4 h-4 text-orange" />
            Theme Color
          </Label>
          <div className="flex flex-wrap gap-2 items-center">
            {PRESET_THEMES.map((preset) => (
              <button
                key={preset.color}
                type="button"
                title={preset.name}
                onClick={() => setValue('background', preset.color, { shouldDirty: true })}
                className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                  currentBackground.toLowerCase() === preset.color.toLowerCase()
                    ? 'ring-2 ring-primary scale-110 border-white'
                    : 'border-transparent opacity-85 hover:opacity-100 hover:scale-105'
                }`}
                style={{ backgroundColor: preset.color }}
              />
            ))}
            <div className="flex items-center gap-2 ml-2">
              <input
                type="color"
                value={currentBackground.startsWith('#') ? currentBackground : '#FFA947'}
                onChange={(e) =>
                  setValue('background', e.target.value, { shouldDirty: true })
                }
                className="w-8 h-8 rounded cursor-pointer border border-border p-0.5 bg-transparent"
                title="Custom Color Picker"
              />
              <Input
                {...register('background')}
                placeholder="#FFA947"
                value={currentBackground}
                onChange={(e) =>
                  setValue('background', e.target.value, { shouldDirty: true })
                }
                className="w-28 font-mono text-xs uppercase"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Applied to the launcher button, user messages, and header accents
          </p>
        </div>

        {/* Text / Bubble Contrast Color */}
        <div className="flex flex-col gap-2">
          <Label className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4" />
            User Message Text Color
          </Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setValue('textColor', '#FFFFFF', { shouldDirty: true })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                currentTextColor.toUpperCase() === '#FFFFFF'
                  ? 'border-orange bg-orange/10 text-orange font-bold'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              Light Text (#FFFFFF)
            </button>
            <button
              type="button"
              onClick={() => setValue('textColor', '#000000', { shouldDirty: true })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                currentTextColor.toUpperCase() === '#000000'
                  ? 'border-orange bg-orange/10 text-orange font-bold'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              Dark Text (#000000)
            </button>
          </div>
          <Input
            {...register('textColor')}
            placeholder="#FFFFFF"
            value={currentTextColor}
            onChange={(e) =>
              setValue('textColor', e.target.value, { shouldDirty: true })
            }
            className="w-28 font-mono text-xs uppercase mt-2"
          />
          {!contrastOk && (
            <div className="flex items-center gap-2 mt-2 text-[10px] text-amber-700 bg-amber-50/50 p-2 rounded border border-amber-200/50">
              <AlertTriangle className="w-3 h-3" />
              <span>
                Contrast below WCAG AA (4.5:1). Consider light text on dark background or vice versa.
              </span>
            </div>
          )}
          {contrastOk && (
            <div className="flex items-center gap-2 mt-2 text-[10px] text-emerald-700 bg-emerald-50/50 p-2 rounded border border-emerald-200/50">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Contrast meets WCAG AA (4.5:1)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BotCustomization
