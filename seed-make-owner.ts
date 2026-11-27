import { client } from '@/lib/prisma'

async function main() {
  // Check customers by email
  const customers = await client.customer.findMany({
    where: { email: { contains: 'hameed404404@gmail.com' } },
    include: { chatRooms: true },
  })
  console.log('Customers with hameed404404@gmail.com:', customers.map(c => ({ id: c.id, name: c.name, email: c.email, domainId: c.domainId })))

  // Get Lakeview Realty domain
  const domain = await client.domain.findFirst({
    where: { publicKey: 'lakeview-realty-key' },
  })
  if (!domain) {
    console.error('Domain lakeview-realty-key not found')
    process.exit(1)
  }

  console.log('\nDomain:', domain.id, domain.name)

  // Get current members
  const members = await client.domainMember.findMany({
    where: { domainId: domain.id },
    include: { user: true },
  })
  console.log('\nCurrent members:')
  members.forEach(m => console.log(`  - ${m.user.fullname} (${m.user.clerkId}) - ${m.role}`))

  // If user hasn't signed in yet via Clerk, there's no User record
  console.log('\n--- IMPORTANT ---')
  console.log('To make hameed404404@gmail.com the owner:')
  console.log('1. Sign in to the app with hameed404404@gmail.com via Clerk')
  console.log('2. This will create a User record with their Clerk ID')
  console.log('3. Then run this script again to assign them as OWNER')
  console.log('\nCurrent Lakeview Realty members:')
  members.forEach(m => console.log(`  - ${m.user.fullname} (clerkId: ${m.user.clerkId}) - ${m.role}`))
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
