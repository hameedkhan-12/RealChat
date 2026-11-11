import type { Metadata } from 'next'
import { ThemeProvider } from '@/providers/theme-provider'
import { ClerkProvider } from '@clerk/nextjs'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import '@fontsource/plus-jakarta-sans/800.css'
import './globals.css'
import { Toaster } from 'sonner'
import { Toaster as UIToaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: 'Voxinar | AI-powered webinars that talk back',
  description: 'Automated AI webinar lead generation and live sales closing platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
      >
        <body
          className="font-sans antialiased"
          suppressHydrationWarning
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            disableTransitionOnChange
          >
            {children}
            <Toaster />
            <UIToaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
