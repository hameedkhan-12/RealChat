# Backup and Recovery

This document describes the PostgreSQL backup strategy, recovery procedure, and recovery objectives for RealChat production deployments.

## Backup Strategy

RealChat uses PostgreSQL as its system of record. All tenant data (conversations, messages, customers, questionnaire responses, knowledge items) lives in a single PostgreSQL database provisioned via Neon (the recommended production hosting per the README).

### Backup Frequency and Retention

| Setting | Value |
|---------|-------|
| Automated backups | Daily (via Neon) |
| Point-in-time recovery (PITR) | Available; 7-day retention (Neon default) |
| Backup storage | Neon-managed, encrypted at rest |
| Access | Restricted to Neon project admins |

Neon automatically takes daily backups and enables point-in-time recovery. No additional backup scripts are required for the default Neon deployment.

### What Is Backed Up

- All tables in the `public` schema (per `prisma/schema.prisma`)
- All tenant data is logically isolated via `domainId` but physically in the same database
- Migration history (`_prisma_migrations` table)

### What Is NOT Backed Up

- Application logs (stdout/stderr)
- Pusher message history (Pusher is a notification mechanism only; the DB is the source of truth)
- Clerk user accounts (managed by Clerk)
- Upstash Redis rate-limit counters (ephemeral; safe to lose)

## Recovery Procedure

### Step 1: Assess the Incident

Determine the recovery point (time) to restore to. Identify when data corruption or loss began.

### Step 2: Provision a Recovery Database

Do NOT restore against the live production database. Create a separate Neon branch or project from the desired backup point.

```bash
# Example: create a Neon branch at a specific point in time
neonctl branch create recovery-$(date +%Y%m%d) --parent main --at "2026-11-20T14:00:00Z"
```

### Step 3: Verify the Recovery Database

- Connect the application to the recovery database via a staging `DATABASE_URL`
- Run `npx prisma migrate deploy` to ensure migrations are current
- Run `npm run test:integration` (against a test database) to verify data integrity
- Spot-check tenant data counts and sample conversations

### Step 4: Cut Over to Production

Once verified, update the production `DATABASE_URL` to point to the recovered database and redeploy the application.

### Step 5: Post-Recovery Validation

- Verify widget session creation works
- Verify conversation list/detail loads for each tenant
- Verify agent takeover and messaging still function
- Check error monitoring (Sentry) for new errors

## Recovery Objectives

| Objective | Target | Basis |
|-----------|--------|-------|
| Recovery Point Objective (RPO) | ≤ 24 hours | Daily automated backups; PITR can reduce to minutes |
| Recovery Time Objective (RTO) | ≤ 4 hours | Time to provision, verify, and cut over a recovery database |

These targets are achievable with Neon's default backup and PITR capabilities. They assume no additional manual backup processes are required.

## Testing

Restoration should be tested at least once per quarter in a staging environment against a restored backup. A backup is not proven until restoration is tested.

Never perform restoration testing against the live production database.

## Monitoring

Monitor:
- Neon backup success/failure alerts
- Database connection failures
- Application 5xx error rate (via error monitoring)

## Responsibilities

- Database backups: Managed by Neon (platform)
- Recovery procedure execution: Engineering team
- Restoration testing: Engineering team (quarterly)
