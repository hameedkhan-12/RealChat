# Corinna AI - Real Estate Chat Widget

Embeddable AI chatbot widget for real estate websites. Built with Next.js 16, TypeScript, Prisma + PostgreSQL, Clerk auth, Pusher, and Tailwind/shadcn/ui.

## Features

- **Multi-tenant architecture**: Each tenant = one domain with isolated data
- **Embeddable chat widget**: JavaScript embed script (`/embed.js`) for any website
- **AI conversation flow**: Server-side state machine with branching logic
- **Human handoff**: Bot → Waiting Agent → Live → Closed status machine
- **Appointment booking**: Timezone-aware slot generation with transactional booking
- **Lead management**: Capture visitor leads with email/phone/name
- **Brand customization**: Logo, colors, welcome message, position
- **Newsletter signup**: Email capture
- **Dashboard**: Conversations, appointments, leads, settings

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Clerk
- **Realtime**: Pusher
- **Styling**: Tailwind CSS + shadcn/ui
- **Testing**: Vitest + Playwright (coming)
- **Email**: Nodemailer (SMTP)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Clerk account
- Pusher account (optional, for realtime features)
- Uploadcare account (optional, for image uploads)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/corinna-ai.git
cd corinna-ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Set up the database
npx prisma migrate dev
npx prisma generate

# Start development server
npm run dev
```

### Environment Variables

See `.env.example` for all required variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key | Yes |
| `PUSHER_APP_ID` | Pusher app ID | No |
| `PUSHER_KEY` | Pusher key | No |
| `PUSHER_SECRET` | Pusher secret | No |
| `PUSHER_CLUSTER` | Pusher cluster | No |
| `NEXT_PUBLIC_PUSHER_KEY` | Pusher public key | No |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Pusher public cluster | No |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL | No |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST token | No |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret | No |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key | No |
| `NEXT_PUBLIC_UPLOAD_CARE_PUBLIC_KEY` | Uploadcare public key | No |
| `SMTP_HOST` | SMTP host | No |
| `SMTP_PORT` | SMTP port | No |
| `SMTP_USER` | SMTP user | No |
| `SMTP_PASS` | SMTP password | No |
| `SMTP_FROM` | SMTP from address | No |

### Deploy

#### Vercel + Neon (Recommended)

1. Push code to GitHub
2. Connect Vercel to your GitHub repo
3. Add environment variables in Vercel dashboard
4. Create a Neon Postgres database
5. Add `DATABASE_URL` to Vercel environment variables
6. Deploy

### Running Tests

```bash
# Run all tests
npm run test

# Run typecheck
npx tsc --noEmit --skipLibCheck

# Run lint
npm run lint

# Run build
npm run build
```

## Architecture

### Conversation Flow

1. Visitor opens chat widget
2. Widget requests session via `/api/widget/session`
3. Bot asks configured questions one at a time
4. Answers are saved to `CustomerResponses`
5. On completion, visitor can book appointment, talk to person, or finish
6. Lead and all answers are saved; tenant is notified via email

### Security

- Tenant-scoped data access (all queries filtered by `domainId`)
- JWT session tokens with SHA-256 hashing
- Rate limiting per IP
- Cloudflare Turnstile bot protection
- Secure embedding with origin validation
- Content Security Policy headers

## Project Structure

```
src/
  actions/          Server actions
  app/              Next.js App Router pages
  components/       React components
  components/ui/    shadcn/ui components
  context/          React context providers
  hooks/            Custom React hooks
  lib/              Utility libraries
  schemas/          Zod validation schemas
  server/           Server-side logic
  providers/        Theme/auth providers
prisma/
  schema.prisma     Database schema
public/
  embed.js          Chatbot embed script
```

## License

MIT
