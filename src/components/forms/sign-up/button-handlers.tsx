'use client'
import { Button } from '@/components/ui/button'
import { useAuthContextHook } from '@/context/use-auth-context'
import Link from 'next/link'
import React from 'react'
import { useFormContext } from 'react-hook-form'

type Props = {}

const ButtonHandler = (props: Props) => {
  const { setCurrentStep, currentStep, loading, onGenerateOTP } =
    useAuthContextHook()
  const { trigger, getValues, setError } = useFormContext()

  const onStep2Continue = async () => {
    const isValid = await trigger([
      'fullname',
      'email',
      'confirmEmail',
      'password',
      'confirmPassword',
    ])
    if (!isValid) return

    const values = getValues()
    if (values.email !== values.confirmEmail) {
      setError('confirmEmail', { message: 'Emails do not match' })
      return
    }
    if (values.password !== values.confirmPassword) {
      setError('confirmPassword', { message: 'Passwords do not match' })
      return
    }

    if (onGenerateOTP) {
      await onGenerateOTP(values.email, values.password, setCurrentStep)
    }
  }

  if (currentStep === 3) {
    return (
      <div className="w-full flex flex-col gap-3 items-center">
        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? 'Creating account…' : 'Create an account'}
        </Button>
        <p>
          Already have an account?{' '}
          <Link
            href="/auth/sign-in"
            className="font-bold"
          >
            Sign In
          </Link>
        </p>
      </div>
    )
  }

  if (currentStep === 2) {
    return (
      <div className="w-full flex flex-col gap-3 items-center">
        <Button
          type="button"
          className="w-full"
          disabled={loading}
          onClick={onStep2Continue}
        >
          {loading ? 'Sending code…' : 'Continue'}
        </Button>
        <p>
          Already have an account?{' '}
          <Link
            href="/auth/sign-in"
            className="font-bold"
          >
            Sign In
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-3 items-center">
      <Button
        type="button"
        className="w-full"
        onClick={() => setCurrentStep(2)}
      >
        Continue
      </Button>
      <p>
        Already have an account?{' '}
        <Link
          href="/auth/sign-in"
          className="font-bold"
        >
          Sign In
        </Link>
      </p>
    </div>
  )
}

export default ButtonHandler
