-- ════════════════════════════════════════════════════════════════════════════
-- business-model-v2 — রিয়েল এস্টেট ডেভেলপার মডেল (Project → Unit[] → Sale) সরিয়ে
-- কনস্ট্রাকশন সার্ভিস মডেল (Lead → Project, এক ক্লায়েন্ট = এক জব)।
-- ════════════════════════════════════════════════════════════════════════════

-- ── ধাপ ০ক: পুরনো LeadStage ভ্যালু নতুন পাইপলাইনে ম্যাপ করা ──────────────────
-- লিড ডেটা টিকে থাকে; enum swap এর আগে text এ নামিয়ে ম্যাপ করা হয়, কারণ পুরনো
-- enum এ নতুন ভ্যালুগুলো (INQUIRY, DISCUSSION …) নেই।
ALTER TABLE "public"."Lead" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "public"."Lead" ALTER COLUMN "stage" TYPE TEXT USING ("stage"::text);

UPDATE "public"."Lead" SET "stage" = 'INQUIRY'    WHERE "stage" = 'NEW';
UPDATE "public"."Lead" SET "stage" = 'DISCUSSION' WHERE "stage" = 'CONTACTED';
UPDATE "public"."Lead" SET "stage" = 'NEGOTIATION' WHERE "stage" = 'BOOKING';
UPDATE "public"."Lead" SET "stage" = 'WON'        WHERE "stage" = 'SALE_AGREEMENT_SIGNED';

-- ── ধাপ ০খ: কনস্ট্রাকশন-পাশের ডেটা খালি করা ────────────────────────────────
-- Unit/Sale ভিত্তিক পুরনো রেকর্ডগুলো নতুন মডেলে ম্যাপ করার উপায় নেই (এক Sale =
-- এক ইউনিট, নতুন মডেলে এক Project = এক Lead)। ডেভেলপমেন্ট ডেটা — `prisma db seed`
-- দিয়ে v2 অনুযায়ী আবার তৈরি হবে।
DELETE FROM "public"."Payment";
DELETE FROM "public"."Installment";
DELETE FROM "public"."PaymentPlan";
DELETE FROM "public"."PhaseUpdate";
DELETE FROM "public"."Phase";
DELETE FROM "public"."Document";
DELETE FROM "public"."Sale";
DELETE FROM "public"."Unit";
DELETE FROM "public"."Project";
DELETE FROM "public"."PhaseTemplate";

-- CreateEnum
CREATE TYPE "public"."BuildingType" AS ENUM ('DUPLEX', 'ONE_STORY', 'TWO_STORY', 'THREE_STORY', 'FOUR_STORY', 'FIVE_PLUS_STORY', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ChecklistStatus" AS ENUM ('PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."LedgerCategory" AS ENUM ('SITE_VISIT', 'DIGITAL_SURVEY', 'SOIL_TEST', 'DESIGN', 'GOVT_APPROVAL', 'CONSTRUCTION_INSTALLMENT', 'MATERIAL_COST', 'LABOR_COST', 'OFFICE_OVERHEAD', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."LedgerType" AS ENUM ('INCOME', 'EXPENSE');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."LeadStage_new" AS ENUM ('INQUIRY', 'DISCUSSION', 'SITE_VISIT_SCHEDULED', 'SITE_VISIT_DONE', 'DIGITAL_SURVEY', 'SOIL_TEST', 'DESIGN_IN_PROGRESS', 'DESIGN_APPROVED', 'QUOTATION_SENT', 'GOVT_APPROVAL', 'NEGOTIATION', 'WON', 'LOST');
ALTER TABLE "public"."Lead" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "public"."Lead" ALTER COLUMN "stage" TYPE "public"."LeadStage_new" USING ("stage"::text::"public"."LeadStage_new");
ALTER TYPE "public"."LeadStage" RENAME TO "LeadStage_old";
ALTER TYPE "public"."LeadStage_new" RENAME TO "LeadStage";
DROP TYPE "public"."LeadStage_old";
ALTER TABLE "public"."Lead" ALTER COLUMN "stage" SET DEFAULT 'INQUIRY';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Document" DROP CONSTRAINT "Document_saleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Lead" DROP CONSTRAINT "Lead_unitId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PaymentPlan" DROP CONSTRAINT "PaymentPlan_saleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Phase" DROP CONSTRAINT "Phase_unitId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PhaseTemplate" DROP CONSTRAINT "PhaseTemplate_projectId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Sale" DROP CONSTRAINT "Sale_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Sale" DROP CONSTRAINT "Sale_leadId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Sale" DROP CONSTRAINT "Sale_unitId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Unit" DROP CONSTRAINT "Unit_projectId_fkey";

-- DropIndex
DROP INDEX "public"."Document_saleId_uploadedAt_idx";

-- DropIndex
DROP INDEX "public"."PaymentPlan_saleId_key";

-- DropIndex
DROP INDEX "public"."Phase_unitId_order_idx";

-- DropIndex
DROP INDEX "public"."PhaseTemplate_projectId_order_idx";

-- AlterTable
ALTER TABLE "public"."Document" DROP COLUMN "saleId",
ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "public"."Installment" ADD COLUMN     "phaseId" TEXT;

-- AlterTable
ALTER TABLE "public"."Lead" DROP COLUMN "unitId",
ADD COLUMN     "buildingType" "public"."BuildingType",
ADD COLUMN     "landSize" TEXT,
ALTER COLUMN "stage" SET DEFAULT 'INQUIRY';

-- AlterTable
ALTER TABLE "public"."PaymentPlan" DROP COLUMN "saleId",
ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Phase" DROP COLUMN "unitId",
ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."PhaseTemplate" DROP COLUMN "projectId";

-- AlterTable
ALTER TABLE "public"."Project" DROP COLUMN "description",
DROP COLUMN "location",
DROP COLUMN "name",
ADD COLUMN     "buildingType" "public"."BuildingType",
ADD COLUMN     "cameraStreamUrl" TEXT,
ADD COLUMN     "customerId" TEXT NOT NULL,
ADD COLUMN     "floors" INTEGER,
ADD COLUMN     "landLocation" TEXT,
ADD COLUMN     "leadId" TEXT NOT NULL,
ADD COLUMN     "ratePerSqft" DECIMAL(65,30),
ADD COLUMN     "status" "public"."ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "totalContractValue" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "totalSqft" DECIMAL(65,30);

-- DropTable
DROP TABLE "public"."Sale";

-- DropTable
DROP TABLE "public"."Unit";

-- DropEnum
DROP TYPE "public"."SaleStatus";

-- DropEnum
DROP TYPE "public"."UnitStatus";

-- CreateTable
CREATE TABLE "public"."LeadChecklistItem" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "public"."ChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "doneById" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LedgerEntry" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "type" "public"."LedgerType" NOT NULL,
    "category" "public"."LedgerCategory" NOT NULL DEFAULT 'OTHER',
    "amount" DECIMAL(65,30) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "receiptNo" TEXT,
    "whatsappSentAt" TIMESTAMP(3),
    "clientVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadChecklistItem_leadId_createdAt_idx" ON "public"."LeadChecklistItem"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_receiptNo_key" ON "public"."LedgerEntry"("receiptNo");

-- CreateIndex
CREATE INDEX "LedgerEntry_leadId_date_idx" ON "public"."LedgerEntry"("leadId", "date");

-- CreateIndex
CREATE INDEX "LedgerEntry_type_date_idx" ON "public"."LedgerEntry"("type", "date");

-- CreateIndex
CREATE INDEX "LedgerEntry_date_idx" ON "public"."LedgerEntry"("date");

-- CreateIndex
CREATE INDEX "Document_projectId_uploadedAt_idx" ON "public"."Document"("projectId", "uploadedAt");

-- CreateIndex
CREATE INDEX "Installment_phaseId_idx" ON "public"."Installment"("phaseId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPlan_projectId_key" ON "public"."PaymentPlan"("projectId");

-- CreateIndex
CREATE INDEX "Phase_projectId_order_idx" ON "public"."Phase"("projectId", "order");

-- CreateIndex
CREATE INDEX "PhaseTemplate_order_idx" ON "public"."PhaseTemplate"("order");

-- CreateIndex
CREATE UNIQUE INDEX "Project_leadId_key" ON "public"."Project"("leadId");

-- CreateIndex
CREATE INDEX "Project_status_createdAt_idx" ON "public"."Project"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."LeadChecklistItem" ADD CONSTRAINT "LeadChecklistItem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadChecklistItem" ADD CONSTRAINT "LeadChecklistItem_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LedgerEntry" ADD CONSTRAINT "LedgerEntry_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentPlan" ADD CONSTRAINT "PaymentPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Installment" ADD CONSTRAINT "Installment_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "public"."Phase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Phase" ADD CONSTRAINT "Phase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
