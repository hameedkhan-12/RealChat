-- Add roomId to CustomerResponses for idempotent per-room answer upsert
ALTER TABLE "CustomerResponses" ADD COLUMN "roomId" UUID;

-- Backfill roomId from the most recent chatRoom for each customer
UPDATE "CustomerResponses" cr
SET "roomId" = (
  SELECT crm."id"
  FROM "ChatRoom" crm
  WHERE crm."customerId" = cr."customerId"
  ORDER BY crm."createdAt" DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM "ChatRoom" crm WHERE crm."customerId" = cr."customerId"
);

-- Make roomId NOT NULL after backfill
ALTER TABLE "CustomerResponses" ALTER COLUMN "roomId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "CustomerResponses" ADD CONSTRAINT "CustomerResponses_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerResponses_roomId_stepKey_key" ON "CustomerResponses"("roomId", "stepKey");

-- CreateIndex
CREATE INDEX "CustomerResponses_roomId_idx" ON "CustomerResponses"("roomId");
