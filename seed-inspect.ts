import { client } from '@/lib/prisma'

async function main() {
  // ── Users ────────────────────────────────────────────────────
  const users = await client.user.findMany({
    select: { id: true, fullname: true, clerkId: true, type: true },
  })
  console.log('\n=== USERS ===')
  console.table(users)

  // ── Domains ──────────────────────────────────────────────────
  const domains = await client.domain.findMany({
    include: {
      members: { include: { user: true } },
      chatBot: true,
    },
  })
  console.log('\n=== DOMAINS ===')
  domains.forEach((d) => {
    const owner = d.members.find((m) => m.role === 'OWNER')
    console.log(`  [${d.id}] "${d.name}"  publicKey=${d.publicKey}`)
    console.log(`    Owner   : ${owner?.user.fullname ?? 'none'}`)
    console.log(`    ChatBot : id=${d.chatBot?.id ?? 'none'}  name=${d.chatBot?.botName ?? '-'}  primaryColor=${d.chatBot?.primaryColor ?? '-'}`)
    console.log(`    Members : ${d.members.map((m) => `${m.user.fullname}(${m.role})`).join(', ')}`)
  })

  // ── Customers / Chat Rooms / Messages ─────────────────────────
  const customers = await client.customer.findMany({
    take: 20,
    include: {
      chatRooms: {
        include: {
          messages: { take: 3, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  console.log('\n=== CUSTOMERS ===')
  customers.forEach((c) => {
    console.log(`  [${c.id}] name="${c.name}" email="${c.email}" domain=${c.domainId}`)
    c.chatRooms.forEach((r) => {
      console.log(`    ChatRoom [${r.id}] status=${r.status}  messages=${r.messages.length}`)
      r.messages.slice(0, 2).forEach((m) =>
        console.log(`      msg: sender=${m.senderType}  "${m.message?.slice(0, 60)}"`)
      )
    })
  })

  // ── Bookings ──────────────────────────────────────────────────
  const bookings = await client.booking.findMany({
    take: 20,
    select: { id: true, domainId: true, startsAt: true, endsAt: true, status: true, email: true, name: true },
  })
  console.log('\n=== BOOKINGS ===')
  if (bookings.length === 0) {
    console.log('  (none)')
  } else {
    console.table(
      bookings.map((b) => ({
        id: b.id,
        status: b.status,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        email: b.email,
        name: b.name,
        domainId: b.domainId,
      }))
    )
  }

  // ── Availability Rules ────────────────────────────────────────
  const avail = await client.availabilityRule.findMany({ take: 20 })
  console.log('\n=== AVAILABILITY RULES ===')
  console.table(avail.map((a) => ({ weekday: a.weekday, startMinute: a.startMinute, endMinute: a.endMinute, domainId: a.domainId })))

  // ── FlowSteps ─────────────────────────────────────────────────
  const steps = await client.flowStep.findMany({ orderBy: { position: 'asc' }, take: 20 })
  console.log('\n=== FLOW STEPS ===')
  steps.forEach((s) => console.log(`  pos=${s.position} key="${s.key}" type=${s.type} prompt="${s.prompt.slice(0, 60)}"`))

  // ── HelpDesk ─────────────────────────────────────────────────
  const helpdesk = await client.helpDesk.findMany({ take: 10 })
  console.log('\n=== HELPDESK ===')
  helpdesk.forEach((h) => console.log(`  Q: ${h.question.slice(0, 70)}`))

  // ── KnowledgeItems ───────────────────────────────────────────
  const knowledge = await client.knowledgeItem.findMany({ take: 10 })
  console.log('\n=== KNOWLEDGE ITEMS ===')
  knowledge.forEach((k) => console.log(`  [${k.category}] "${k.title.slice(0, 60)}"`))
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
