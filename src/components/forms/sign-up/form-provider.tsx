'use client'
import { AuthContextProvider } from '@/context/use-auth-context'
import { useSignUpForm } from '@/hooks/sign-up/use-sign-up'
import React, { useState } from 'react'
import { FormProvider } from 'react-hook-form'

type Props = {
  children: React.ReactNode
}

const SignUpFormProvider = ({ children }: Props) => {
  const { methods, onHandleSubmit, loading, setLoading, onGenerateOTP } =
    useSignUpForm()
  const [currentStep, setCurrentStep] = useState<number>(1)

  return (
    <AuthContextProvider
      value={{
        currentStep,
        setCurrentStep,
        loading,
        setLoading,
        onGenerateOTP,
      }}
    >
      <FormProvider {...methods}>
        <form
          onSubmit={onHandleSubmit}
          className="h-full"
        >
          <div className="flex flex-col justify-between gap-3 h-full">
            {children}
            <div id="clerk-captcha" />
          </div>
        </form>
      </FormProvider>
    </AuthContextProvider>
  )
}

export default SignUpFormProvider
