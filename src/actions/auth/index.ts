'use server'

import { client } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { onGetAllAccountDomains } from '../settings'

export const onCompleteUserRegistration = async (
  fullname: string,
  clerkId: string,
  type: string
) => {
  try {
    const registered = await client.user.create({
      data: { fullname, clerkId, type },
      select: { fullname: true, id: true, type: true },
    })
    return { status: 200, user: registered }
  } catch {
    return { status: 400 }
  }
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