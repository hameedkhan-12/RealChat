
import { onIntegrateDomain } from '@/actions/settings'
import { useToast } from '@/components/ui/use-toast'
import { AddDomainSchema } from '@/schemas/settings.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { UploadClient } from '@uploadcare/upload-client'
import { usePathname, useRouter } from 'next/navigation'

import { useEffect, useState } from 'react'
import { FieldValues, useForm } from 'react-hook-form'

const upload = new UploadClient({
  publicKey: process.env.NEXT_PUBLIC_UPLOAD_CARE_PUBLIC_KEY as string,
})

function okMessage(res: any): string | null {
  return res && res.ok && typeof res.data === 'object' ? String((res.data as any).message ?? '') : null
}

export const useDomain = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FieldValues>({
    resolver: zodResolver(AddDomainSchema),
  })

  const pathname = usePathname()
  const { toast } = useToast()
  const [loading, setLoading] = useState<boolean>(false)
  const [isDomain, setIsDomain] = useState<string | undefined>(undefined)
  const router = useRouter()

  useEffect(() => {
    setIsDomain(pathname.split('/').pop())
  }, [pathname])

  const onAddDomain = handleSubmit(async (values: FieldValues) => {
    setLoading(true)
    const uploaded = await upload.uploadFile(values.image[0])
    const domain = await onIntegrateDomain(values.domain, uploaded.uuid)
    if (domain?.ok) {
      reset()
      setLoading(false)
      toast({
        title: 'Success',
        description: okMessage(domain),
      })
      router.refresh()
    } else if (domain) {
      setLoading(false)
      toast({
        title: 'Error',
        description: domain.error ?? 'Failed to add domain',
      })
    }
  })

  return {
    register,
    onAddDomain,
    errors,
    loading,
    isDomain,
  }
}
