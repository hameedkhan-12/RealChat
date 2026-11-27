import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

const user = await p.user.findUnique({ where: { clerkId: 'user_3LP3RL6rDH6zW0xdY6caljXr8U8' }, select: { id: true } })
const domain = 'Lakeview Realty'
try {
  const rec = await p.domain.findFirst({
    where: {
      OR: [{ name: domain }, { name: { startsWith: `${domain}.` } }],
      members: { some: { userId: user?.id } },
    },
    include: {
      chatBot: true,
      helpdesk: true,
      filterQuestions: true,
      members: { include: { user: true } },
    },
  })
  console.log('query OK, found:', rec ? rec.name : 'NOT FOUND')
} catch (e) {
  console.log('QUERY FAILED:', String(e).slice(0, 1000))
}
await p.$disconnect()
