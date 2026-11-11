'use client'
import { Button } from '@/components/ui/button'
import { useSignInForm } from '@/hooks/sign-in/use-sign-in'
import Link from 'next/link'
import React from 'react'
import { FormProvider } from 'react-hook-form'

type Props = {
  children: React.ReactNode
}

const SignInFormProvider = ({ children }: Props) => {
  const { methods, onHandleSubmit, loading } = useSignInForm()

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={onHandleSubmit}
        className="h-full"
      >
        <div className="flex flex-col gap-3 h-full">
          {children}
          <div id="clerk-captcha" />

          <div className="w-full flex flex-col gap-3 items-center">
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Submit'}
            </Button>
            <p>
              Don&apos;t have an account?{' '}
              <Link
                href="/auth/sign-up"
                className="font-bold"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}

export default SignInFormProvider
