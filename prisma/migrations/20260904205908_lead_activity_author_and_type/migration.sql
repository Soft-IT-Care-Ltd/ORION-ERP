-- CreateEnum
CREATE TYPE "public"."LeadActivityType" AS ENUM ('CREATED', 'NOTE', 'STAGE_CHANGED', 'ASSIGNED', 'FOLLOW_UP_SET');

-- AlterTable
ALTER TABLE "public"."LeadActivity" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "type" "public"."LeadActivityType" NOT NULL DEFAULT 'NOTE';

-- CreateIndex
CREATE INDEX "Lead_assignedToId_stage_idx" ON "public"."Lead"("assignedToId", "stage");

-- CreateIndex
CREATE INDEX "Lead_nextFollowUpAt_idx" ON "public"."Lead"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "public"."LeadActivity"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."LeadActivity" ADD CONSTRAINT "LeadActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
