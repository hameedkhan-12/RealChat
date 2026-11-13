-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "kind" TEXT,
ADD COLUMN "metadata" JSON;

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "domainId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeItem_domainId_idx" ON "KnowledgeItem"("domainId");

-- CreateIndex
CREATE INDEX "KnowledgeItem_domainId_isActive_idx" ON "KnowledgeItem"("domainId", "isActive");

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
