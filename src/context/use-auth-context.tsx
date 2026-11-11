"use client"
import React, { useState } from 'react'

type InitialValuesProps = {
  currentStep: number
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>
  loading?: boolean
  setLoading?: React.Dispatch<React.SetStateAction<boolean>>
  onGenerateOTP?: (
    email: string,
    password: string,
    onNext: React.Dispatch<React.SetStateAction<number>>
  ) => Promise<void>
}

const InitialValues: InitialValuesProps = {
  currentStep: 1,
  setCurrentStep: () => undefined,
  loading: false,
  setLoading: () => undefined,
  onGenerateOTP: async () => undefined,
}

const authContext = React.createContext<InitialValuesProps>(InitialValues)

const { Provider } = authContext

export const AuthContextProvider = ({
  children,
  value,
}: {
  children: React.ReactNode
  value?: Partial<InitialValuesProps>
}) => {
  const [currentStep, setCurrentStep] = useState<number>(
    value?.currentStep ?? InitialValues.currentStep
  )
  const [loading, setLoading] = useState<boolean>(
    value?.loading ?? false
  )

  const values: InitialValuesProps = {
    currentStep: value?.currentStep ?? currentStep,
    setCurrentStep: value?.setCurrentStep ?? setCurrentStep,
    loading: value?.loading ?? loading,
    setLoading: value?.setLoading ?? setLoading,
    onGenerateOTP: value?.onGenerateOTP ?? InitialValues.onGenerateOTP,
  }

  return <Provider value={values}>{children}</Provider>
}

export const useAuthContextHook = () => {
  const state = React.useContext(authContext)
  return state
}
