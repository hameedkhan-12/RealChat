import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

const domainName = 'Lakeview Realty'
const user = await p.user.findUnique({ where: { clerkId: 'user_3LP3RL6rDH6zW0xdY6caljXr8U8' }, select: { id: true } })
console.log('user:', user)

const all = await p.domain.findMany({ where: { members: { some: { userId: user?.id } } }, select: { id: true, name: true } })
console.log('memberships:', all)
for (const d of all) {
  console.log(`  name=${JSON.stringify(d.name)} codes=${[...d.name].map(c => c.charCodeAt(0)).join(',')} len=${d.name.length}`)
}
console.log('target codes=', [...domainName].map(c => c.charCodeAt(0)).join(','), 'len=', domainName.length)

const found = await p.domain.findFirst({
  where: {
    OR: [{ name: domainName }, { name: { startsWith: `${domainName}.` } }],
    members: { some: { userId: user?.id } },
  },
  select: { id: true, name: true },
})
console.log('onGetCurrentDomainInfo lookup:', found ?? 'NOT FOUND')

await p.$disconnect()
