-- AlterTable
ALTER TABLE "ChatRoom" ADD COLUMN "flowCompletedAt" TIMESTAMP(3),
ADD COLUMN "leadNotifiedAt" TIMESTAMP(3),
ADD COLUMN "handoffRequestedAt" TIMESTAMP(3),
ADD COLUMN "waitingEscalatedAt" TIMESTAMP(3),
ADD COLUMN "locale" TEXT;

-- AlterTable
ALTER TABLE "ChatRoom" ALTER COLUMN "customerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CustomerResponses" ALTER COLUMN "stepKey" SET NOT NULL,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "phone" TEXT,
ADD COLUMN "visitorTimezone" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "reminder24hSentAt" TIMESTAMP(3),
ADD COLUMN "reminder1hSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AvailabilityRule" ALTER COLUMN "weekday" SET NOT NULL;

-- AlterTable
ALTER TABLE "AvailabilityException" ALTER COLUMN "date" SET NOT NULL;

-- DropIndex
DROP INDEX "ChatRoom_sessionTokenHash_idx";

-- DropIndex
DROP INDEX "Booking_domainId_startsAt_key";

-- DropIndex
DROP INDEX "AvailabilityRule_domainId_weekday_idx";

-- DropIndex
DROP INDEX "AvailabilityException_domainId_date_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_sessionTokenHash_key" ON "ChatRoom"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "ChatRoom_status_lastActivityAt_idx" ON "ChatRoom"("status", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerResponses_customerId_stepKey_key" ON "CustomerResponses"("customerId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityRule_domainId_weekday_key" ON "AvailabilityRule"("domainId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityException_domainId_date_key" ON "AvailabilityException"("domainId", "date");

-- CreateIndex
CREATE INDEX "Customer_domainId_createdAt_idx" ON "Customer"("domainId", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_status_startsAt_idx" ON "Booking"("status", "startsAt");

-- CreateTable
CREATE TABLE "DomainInvite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "domainId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "DomainMemberRole" NOT NULL DEFAULT 'AGENT',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomainInvite_domainId_idx" ON "DomainInvite"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "DomainInvite_tokenHash_key" ON "DomainInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "DomainInvite_email_idx" ON "DomainInvite"("email");

-- AddForeignKey
ALTER TABLE "DomainInvite" ADD CONSTRAINT "DomainInvite_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index: at most one CONFIRMED booking per (domainId, startsAt); cancelled slots may be re-booked.
CREATE UNIQUE INDEX "Booking_domainId_startsAt_confirmed_key"
  ON "Booking" ("domainId", "startsAt")
  WHERE "status" = 'CONFIRMED';
