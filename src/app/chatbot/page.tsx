import type { Metadata } from 'next'
import ChatWidget from '@/components/chatbot'

export const metadata: Metadata = { robots: { index: false, follow: false } }

type SP = Promise<Record<string, string | string[] | undefined>>

export default async function ChatbotPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)
  const utm: Record<string, string> = {}
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const v = one(k)
    if (v) utm[k] = v.slice(0, 100)
  }
  const lang = one('lang')
  return (
    <ChatWidget
      publicKey={one('key')}
      pageUrl={one('page')?.slice(0, 500)}
      utm={utm}
      lang={lang === 'ar' || lang === 'en' ? lang : undefined}
    />
  )
}
