import { client } from '@/lib/prisma'

const LAKEVIEW_DOMAIN_ID = '6a21ee2b-3edb-4657-a7a8-7323c43d5918'

async function main() {
  // ── 1. Add Availability Rules: Mon–Fri 10am–5pm (600–1020 minutes) ──
  console.log('\n[1] Adding availability rules for Lakeview Realty...')

  // Delete any existing rules first to avoid unique constraint errors
  await client.availabilityRule.deleteMany({ where: { domainId: LAKEVIEW_DOMAIN_ID } })

  const rules = await client.availabilityRule.createMany({
    data: [1, 2, 3, 4, 5].map((weekday) => ({
      domainId: LAKEVIEW_DOMAIN_ID,
      weekday,       // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
      startMinute: 600,  // 10:00 AM
      endMinute: 1020,   // 5:00 PM
    })),
  })
  console.log(`  ✅ Created ${rules.count} availability rules (Mon–Fri 10am–5pm)`)

  // ── 2. Delete ghost "User" accounts (auto-created stubs from test sign-ins) ──
  console.log('\n[2] Cleaning up ghost User accounts...')

  // Safety: only delete Users with no domain memberships
  const ghostUsers = await client.user.findMany({
    where: {
      fullname: 'User',
      type: 'owner',
      memberships: { none: {} },
    },
    select: { id: true, clerkId: true },
  })

  console.log(`  Found ${ghostUsers.length} orphaned ghost users with no memberships`)

  if (ghostUsers.length > 0) {
    const deleted = await client.user.deleteMany({
      where: {
        id: { in: ghostUsers.map((u) => u.id) },
      },
    })
    console.log(`  ✅ Deleted ${deleted.count} ghost User accounts`)
  } else {
    console.log('  ℹ️  No ghost users to delete (all have memberships)')
  }

  // ── 3. Summary ───────────────────────────────────────────────────────
  console.log('\n[3] Final state check...')
  const availRules = await client.availabilityRule.findMany({ where: { domainId: LAKEVIEW_DOMAIN_ID } })
  const userCount = await client.user.count()
  console.log(`  Availability rules: ${availRules.length} (weekdays: ${availRules.map((r) => r.weekday).join(', ')})`)
  console.log(`  Total users remaining: ${userCount}`)
  console.log('\n✅ All setup steps complete!')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
