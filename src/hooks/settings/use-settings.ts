import {
  onChatBotImageUpdate,
  onCreateFilterQuestions,
  onCreateHelpDeskQuestion,
  onCreateNewDomainProduct,
  onDeleteUserDomain,
  onGetAllFilterQuestions,
  onGetAllHelpDeskQuestions,
  onUpdateDomain,
  onUpdatePassword,
  onUpdateWelcomeMessage,
  onUpdateChatBotTheme,
} from '@/actions/settings'
import { useToast } from '@/components/ui/use-toast'
import {
  ChangePasswordProps,
  ChangePasswordSchema,
} from '@/schemas/auth.schema'
import {
  AddProductProps,
  AddProductSchema,
  DomainSettingsProps,
  DomainSettingsSchema,
  FilterQuestionsProps,
  FilterQuestionsSchema,
  HelpDeskQuestionsProps,
  HelpDeskQuestionsSchema,
} from '@/schemas/settings.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { UploadClient } from '@uploadcare/upload-client'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

const upload = new UploadClient({
  publicKey: process.env.NEXT_PUBLIC_UPLOAD_CARE_PUBLIC_KEY as string,
})

export const useThemeMode = () => {
  const { setTheme, theme } = useTheme()
  return {
    setTheme,
    theme,
  }
}

function okMessage(res: any): string | null {
  return res && res.ok && typeof res.data === 'object' ? String((res.data as any).message ?? '') : null
}
function okStatus(res: any): number | null {
  return res && res.ok && typeof res.data === 'object' ? Number((res.data as any).status ?? 200) : null
}
function okQuestions(res: any): any[] | null {
  return res && res.ok && typeof res.data === 'object' ? (res.data as any).questions ?? null : null
}

export const useChangePassword = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChangePasswordProps>({
    resolver: zodResolver(ChangePasswordSchema),
    mode: 'onChange',
  })
  const { toast } = useToast()
  const [loading, setLoading] = useState<boolean>(false)

  const onChangePassword = handleSubmit(async (values) => {
    try {
      setLoading(true)
      const updated = await onUpdatePassword(values.password)
      if (updated?.ok) {
        reset()
        setLoading(false)
        toast({ title: 'Success', description: okMessage(updated) })
      }
    } catch (error) {
      console.log(error)
    }
  })
  return {
    register,
    errors,
    onChangePassword,
    loading,
  }
}

export const useSettings = (id: string) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    control,
  } = useForm<DomainSettingsProps>({
    resolver: zodResolver(DomainSettingsSchema),
  })
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState<boolean>(false)
  const [deleting, setDeleting] = useState<boolean>(false)

  const onUpdateSettings = handleSubmit(async (values) => {
    setLoading(true)
    if (values.domain) {
      const domain = await onUpdateDomain(id, values.domain)
      if (domain?.ok) {
        toast({
          title: 'Success',
          description: okMessage(domain),
        })
      }
    }
    if (values.image?.[0]) {
      const uploaded = await upload.uploadFile(values.image[0])
      const image = await onChatBotImageUpdate(id, uploaded.uuid)
      if (image?.ok) {
        toast({
          title: okStatus(image) === 200 ? 'Success' : 'Error',
          description: okMessage(image),
        })
        setLoading(false)
      }
    }
    if (values.welcomeMessage) {
      const message = await onUpdateWelcomeMessage(values.welcomeMessage, id)
      if (message?.ok) {
        toast({
          title: 'Success',
          description: okMessage(message),
        })
      }
    }
    if (
      values.background ||
      values.textColor ||
      values.botName !== undefined ||
      values.branding !== undefined
    ) {
      const packedData = JSON.stringify({
        color: values.textColor || '#ffffff',
        botName: values.botName || '',
        branding: values.branding || '',
      })
      const themeRes = await onUpdateChatBotTheme(
        id,
        values.background,
        packedData
      )
      if (themeRes?.ok) {
        toast({
          title: 'Success',
          description: okMessage(themeRes),
        })
      }
    }
    reset(values)
    router.refresh()
    setLoading(false)
  })

  const onDeleteDomain = async () => {
    setDeleting(true)
    const deleted = await onDeleteUserDomain(id)
    if (deleted?.ok) {
      toast({
        title: 'Success',
        description: okMessage(deleted),
      })
      setDeleting(false)
      router.refresh()
    }
  }
  return {
    register,
    onUpdateSettings,
    errors,
    loading,
    onDeleteDomain,
    deleting,
    setValue,
    watch,
    control,
  }
}

export const useHelpDesk = (id: string) => {
  const {
    register,
    formState: { errors },
    handleSubmit,
    reset,
  } = useForm<HelpDeskQuestionsProps>({
    resolver: zodResolver(HelpDeskQuestionsSchema),
  })
  const { toast } = useToast()

  const [loading, setLoading] = useState<boolean>(false)
  const [isQuestions, setIsQuestions] = useState<
    { id: string; question: string; answer: string }[]
  >([])
  const onSubmitQuestion = handleSubmit(async (values) => {
    setLoading(true)
    const question = await onCreateHelpDeskQuestion(
      id,
      values.question,
      values.answer
    )
    if (question?.ok) {
      setIsQuestions(okQuestions(question)!)
      toast({
        title: okStatus(question) === 200 ? 'Success' : 'Error',
        description: okMessage(question),
      })
      setLoading(false)
      reset()
    }
  })

  const onGetQuestions = async () => {
    setLoading(true)
    const questions = await onGetAllHelpDeskQuestions(id)
    if (questions?.ok) {
      setIsQuestions(okQuestions(questions)!)
      setLoading(false)
    }
  }

  useEffect(() => {
    onGetQuestions()
  }, [])

  return {
    register,
    onSubmitQuestion,
    errors,
    isQuestions,
    loading,
  }
}

export const useFilterQuestions = (id: string) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FilterQuestionsProps>({
    resolver: zodResolver(FilterQuestionsSchema),
  })
  const { toast } = useToast()
  const [loading, setLoading] = useState<boolean>(false)
  const [isQuestions, setIsQuestions] = useState<
    { id: string; question: string }[]
  >([])

  const onAddFilterQuestions = handleSubmit(async (values) => {
    setLoading(true)
    const questions = await onCreateFilterQuestions(id, values.question)
    if (questions?.ok) {
      setIsQuestions(okQuestions(questions)!)
      toast({
        title: okStatus(questions) === 200 ? 'Success' : 'Error',
        description: okMessage(questions),
      })
      reset()
      setLoading(false)
    }
  })

  const onGetQuestions = async () => {
    setLoading(true)
    const questions = await onGetAllFilterQuestions(id)
    if (questions?.ok) {
      setIsQuestions(okQuestions(questions)!)
      setLoading(false)
    }
  }

  useEffect(() => {
    onGetQuestions()
  }, [])

  return {
    loading,
    onAddFilterQuestions,
    register,
    errors,
    isQuestions,
  }
}

export const useProducts = (domainId: string) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState<boolean>(false)
  const {
    register,
    reset,
    formState: { errors },
    handleSubmit,
  } = useForm<AddProductProps>({
    resolver: zodResolver(AddProductSchema),
  })

  const onCreateNewProduct = handleSubmit(async (values) => {
    try {
      setLoading(true)
      const uploaded = await upload.uploadFile(values.image[0])
      const product = await onCreateNewDomainProduct(
        domainId,
        values.name,
        uploaded.uuid,
        values.price
      )
      if (product?.ok) {
        reset()
        toast({
          title: 'Success',
          description: okMessage(product),
        })
        setLoading(false)
      }
    } catch (error) {
      console.log(error)
    }
  })

  return { onCreateNewProduct, register, errors, loading }
}
