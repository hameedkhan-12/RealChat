'use server'

import { client } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { action } from '@/lib/action'
import { onGetAllAccountDomains } from '../settings'

export const onCompleteUserRegistration = async (fullname?: string) => {
  return action(async () => {
    const { user } = await requireUser()
    if (fullname && user.fullname !== fullname) {
      await client.user.update({ where: { id: user.id }, data: { fullname } })
    }
    return { status: 200, user: { fullname: user.fullname, id: user.id, type: user.type } }
  })
}

export const onLoginUser = async () => {
  const user = await currentUser()
  if (!user) redirect('/auth/sign-in')
  try {
    const authenticated = await client.user.findUnique({
      where: { clerkId: user.id },
      select: { fullname: true, id: true, type: true },
    })
    if (!authenticated) return { status: 400 }
    const domains = await onGetAllAccountDomains()
    return { status: 200, user: authenticated, domain: domains?.domains ?? [] }
  } catch {
    return { status: 400 }
  }
}