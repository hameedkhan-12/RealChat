import { useToast } from '@/components/ui/use-toast'
import { UserLoginProps, UserLoginSchema } from '@/schemas/auth.schema'
import { useSignIn } from '@clerk/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

export const useSignInForm = () => {
  const { isLoaded, setActive, signIn } = useSignIn()
  const [loading, setLoading] = useState<boolean>(false)
  const router = useRouter()
  const { toast } = useToast()
  const methods = useForm<UserLoginProps>({
    resolver: zodResolver(UserLoginSchema),
    mode: 'onChange',
  })
  const onHandleSubmit = methods.handleSubmit(
    async (values: UserLoginProps) => {
      if (!isLoaded) {
        toast({
          title: 'Please wait',
          description: 'Authentication is still initializing. Please try again in a moment.',
        })
        return
      }

      try {
        setLoading(true)
        const authenticated = await signIn.create({
          strategy: 'password',
          identifier: values.email,
          password: values.password,
        })

        if (authenticated.status === 'complete') {
          await setActive({ session: authenticated.createdSessionId })
          toast({
            title: 'Success',
            description: 'Welcome back!',
          })
          router.push('/dashboard')
        } else {
          setLoading(false)
          toast({
            title: 'Error',
            description: 'Unable to sign in. Please try again.',
          })
        }
      } catch (error: any) {
        setLoading(false)
        console.error('Sign-in error:', error)
        const errorMessage =
          error.errors?.[0]?.longMessage ||
          error.errors?.[0]?.message ||
          error.message ||
          'Something went wrong. Please try again.'
        toast({
          title: 'Error',
          description: errorMessage,
        })
      }
    },
    (errors) => {
      console.error('Form validation errors:', errors)
    }
  )

  return {
    methods,
    onHandleSubmit,
    loading,
  }
}
