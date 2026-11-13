import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-bold">Real Estate Chat Widget</h1>
      <p className="mt-3 text-muted-foreground max-w-xl">
        Sign in to configure your embeddable chat widget, manage leads, conversations, and appointments.
      </p>
      <div className="mt-6 flex gap-3">
        <Link className="underline" href="/auth/sign-in">Sign in</Link>
        <Link className="underline" href="/auth/sign-up">Sign up</Link>
      </div>
    </main>
  )
}
