'use client'
import { useToast } from '@/components/ui/use-toast'
import {
  UserRegistrationProps,
  UserRegistrationSchema,
} from '@/schemas/auth.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSignUp } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { onCompleteUserRegistration } from '@/actions/auth'

export const useSignUpForm = () => {
  const { toast } = useToast()
  const [loading, setLoading] = useState<boolean>(false)
  const { signUp, isLoaded, setActive } = useSignUp()
  const router = useRouter()
  const methods = useForm<UserRegistrationProps>({
    resolver: zodResolver(UserRegistrationSchema),
    defaultValues: {
      type: 'owner',
    },
    mode: 'onChange',
  })

  const onGenerateOTP = async (
    email: string,
    password: string,
    onNext: React.Dispatch<React.SetStateAction<number>>
  ) => {
    if (!isLoaded) {
      toast({
        title: 'Please wait',
        description: 'Authentication is still initializing. Please try again in a moment.',
      })
      return
    }

    try {
      setLoading(true)
      await signUp.create({
        emailAddress: email,
        password: password,
      })

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })

      setLoading(false)
      onNext(3)
    } catch (error: any) {
      setLoading(false)
      console.error('Sign-up generate OTP error:', error)
      toast({
        title: 'Error',
        description:
          error.errors?.[0]?.longMessage ||
          error.errors?.[0]?.message ||
          error.message ||
          'Unable to send verification code. Please check your email and password.',
      })
    }
  }

  const onHandleSubmit = methods.handleSubmit(
    async (values: UserRegistrationProps) => {
      if (!isLoaded) return

      try {
        setLoading(true)
        const completeSignUp = await signUp.attemptEmailAddressVerification({
          code: values.otp,
        })

        if (completeSignUp.status !== 'complete') {
          setLoading(false)
          toast({
            title: 'Error',
            description: 'Verification incomplete. Please check the code and try again.',
          })
          return
        }

        const userId = completeSignUp.createdUserId || signUp.createdUserId
        if (!userId) {
          setLoading(false)
          toast({
            title: 'Error',
            description: 'User ID missing from Clerk registration.',
          })
          return
        }

        const registered = await onCompleteUserRegistration()

        if (registered?.ok && registered.data) {
          await setActive({
            session: completeSignUp.createdSessionId,
          })

          setLoading(false)
          toast({
            title: 'Success',
            description: 'Account created successfully!',
          })
          router.push('/dashboard')
        } else {
          setLoading(false)
          toast({
            title: 'Error',
            description: 'Failed to complete registration in database.',
          })
        }
      } catch (error: any) {
        setLoading(false)
        console.error('Sign-up error:', error)
        toast({
          title: 'Error',
          description:
            error.errors?.[0]?.longMessage ||
            error.errors?.[0]?.message ||
            error.message ||
            'Something went wrong!',
        })
      }
    },
    (errors) => {
      console.error('Form validation errors on sign up:', errors)
      const firstError = Object.values(errors)[0]
      if (firstError?.message) {
        toast({
          title: 'Validation Error',
          description: String(firstError.message),
        })
      }
    }
  )

  return {
    methods,
    onHandleSubmit,
    onGenerateOTP,
    loading,
    setLoading,
  }
}
