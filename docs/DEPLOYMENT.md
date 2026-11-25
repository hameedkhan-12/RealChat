# Deployment

This document describes the RealChat production deployment process, database migration procedure, and rollback strategy.

## Architecture

RealChat is a Next.js 16 modular monolith deployed to Vercel, with a PostgreSQL database on Neon.

- Application: Vercel (serverless functions + Edge middleware)
- Database: Neon PostgreSQL
- Auth: Clerk
- Realtime: Pusher
- Rate limiting: Upstash Redis
- Bot protection: Cloudflare Turnstile
- Email: SMTP (Nodemailer)

## Environment Variables

Never commit `.env` files. Required production variables (see `.env.example` for the full list):

- `DATABASE_URL` — PostgreSQL connection string (pooled, with `sslmode=require`)
- `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk auth
- `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` — Pusher realtime
- `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` — Pusher client keys
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — Rate limiting
- `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — Cloudflare Turnstile
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — Email
- `CRON_SECRET` — Cron endpoint protection
- `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` — LLM provider
- `NEXT_PUBLIC_APP_URL` — Application base URL

Server-only secrets must never be exposed through `NEXT_PUBLIC_` variables.

## Deployment Procedure

1. **Review code changes** in a pull request; require approval before merging to `main`.
2. **Run automated checks** — the CI pipeline (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, integration tests, and the production build on every push and PR.
3. **Merge to `main`** — Vercel automatically deploys on push to `main`.
4. **Review pending database migrations** — if the PR includes `prisma/schema.prisma` changes, a new migration must be created and reviewed.
5. **Apply migrations** — run `npx prisma migrate deploy` against the production database as a controlled step (not automatically on every deploy).
6. **Verify health checks** — confirm `GET /api/health` returns `{status: "ok"}`.
7. **Verify widget and dashboard** — test widget embedding, owner dashboard, agent dashboard, and human takeover.
8. **Monitor application errors** — watch error monitoring (Sentry) and 5xx rates after deploy.

## Database Migration Procedure

Migrations are managed with Prisma Migrate. Migration files live in `prisma/migrations/`.

### Creating a New Migration

1. Edit `prisma/schema.prisma` to reflect the desired schema change.
2. Generate the migration SQL: `npx prisma migrate dev --name <description>` (against a local/dev database).
3. Review the generated SQL in `prisma/migrations/<timestamp>_<description>/migration.sql`.
4. Ensure the change is backward-compatible (additive preferred; avoid destructive changes).
5. Commit the migration file with the schema change.

### Applying Migrations to Production

Migrations are applied as a controlled step, separate from application deployment:

```bash
npx prisma migrate deploy
```

This runs all pending migrations against the production database. It is non-destructive for additive changes.

### Rollback Compatibility

Prisma Migrate does not support automatic "down" migrations. To roll back a schema change:

1. Create a new migration that reverses the change (e.g., drop an added column or table).
2. Apply it via `npx prisma migrate deploy`.

Do not assume rolling back application code rolls back database migrations. Application code should support both old and new schema states during a transition.

## Rollback Strategy

### Application Rollback

If a deployment introduces a regression:

1. Revert the application commit on `main` (or deploy the previous known-good image).
2. Vercel redeploys automatically on push to `main`.

### Database Rollback

Database schema changes are NOT automatically rolled back with application code. If a migration causes issues:

1. Create a reversing migration.
2. Apply it via `npx prisma migrate deploy`.
3. Verify application functionality.

### Data Rollback

If data corruption is suspected, follow the restoration procedure in `docs/BACKUP_AND_RECOVERY.md`.

## Health Checks

`GET /api/health` returns `{status: "ok", timestamp, env, service}`. Use this for load balancer and uptime monitoring. It does not check database connectivity (liveness only).

## Responsibilities

- Application deployment: Vercel (automatic on push to `main`)
- Migration application: Engineering team (controlled step)
- Production incident response: Engineering team
