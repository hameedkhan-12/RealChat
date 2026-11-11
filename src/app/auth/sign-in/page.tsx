import SignInFormProvider from '@/components/forms/sign-in/form-provider'
import LoginForm from '@/components/forms/sign-in/login-form'
import Link from 'next/link'
import React from 'react'

const SignInPage = () => {
  return (
    <div className="flex-1 py-36 md:px-16 w-full">
      <div className="flex flex-col h-full gap-3">
        <SignInFormProvider>
          <LoginForm />
        </SignInFormProvider>
      </div>
    </div>
  )
}

export default SignInPage
