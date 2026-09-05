-- DropForeignKey
ALTER TABLE "public"."Phase" DROP CONSTRAINT "Phase_unitId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PhaseTemplate" DROP CONSTRAINT "PhaseTemplate_projectId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PhaseUpdate" DROP CONSTRAINT "PhaseUpdate_phaseId_fkey";

-- AlterTable
ALTER TABLE "public"."Phase" ADD COLUMN     "delayReason" TEXT;

-- AlterTable
ALTER TABLE "public"."PhaseUpdate" ADD COLUMN     "percentComplete" INTEGER;

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "engineerId" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Phase_unitId_order_idx" ON "public"."Phase"("unitId", "order");

-- CreateIndex
CREATE INDEX "PhaseTemplate_projectId_order_idx" ON "public"."PhaseTemplate"("projectId", "order");

-- CreateIndex
CREATE INDEX "PhaseUpdate_phaseId_createdAt_idx" ON "public"."PhaseUpdate"("phaseId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_engineerId_idx" ON "public"."Project"("engineerId");

-- CreateIndex
CREATE INDEX "Unit_projectId_status_idx" ON "public"."Unit"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_projectId_unitNo_key" ON "public"."Unit"("projectId", "unitNo");

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhaseTemplate" ADD CONSTRAINT "PhaseTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Phase" ADD CONSTRAINT "Phase_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "public"."Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhaseUpdate" ADD CONSTRAINT "PhaseUpdate_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "public"."Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

