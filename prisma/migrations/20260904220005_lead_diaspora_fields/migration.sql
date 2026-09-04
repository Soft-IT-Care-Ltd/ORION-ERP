-- CreateEnum
CREATE TYPE "public"."LeadFileType" AS ENUM ('FLOOR_PLAN', 'THREE_D_DESIGN', 'PROPOSAL', 'LAND_DOCUMENT', 'OTHER');

-- AlterTable
ALTER TABLE "public"."Lead" ADD COLUMN     "localContactName" TEXT,
ADD COLUMN     "localContactPhone" TEXT,
ADD COLUMN     "localContactRelation" TEXT,
ADD COLUMN     "projectLocation" TEXT,
ADD COLUMN     "residenceCountry" TEXT;

-- CreateTable
CREATE TABLE "public"."LeadDocument" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" "public"."LeadFileType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadDocument_leadId_uploadedAt_idx" ON "public"."LeadDocument"("leadId", "uploadedAt");

-- AddForeignKey
ALTER TABLE "public"."LeadDocument" ADD CONSTRAINT "LeadDocument_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadDocument" ADD CONSTRAINT "LeadDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data migration: phone এখন E.164 তে রাখা হয় (PRD সেকশন ৫.১ — international format)।
-- আগের রেকর্ডগুলোতে বাংলাদেশি লোকাল ফরম্যাট (01XXXXXXXXX) ছিল — সেগুলো +880 প্রিফিক্স করা হলো।
-- অন্য কোনো ফরম্যাট থাকলে অপরিবর্তিত থাকবে (UI raw মান দেখাতে পারে)।
UPDATE "public"."Lead"
SET "phone" = '+880' || substring("phone" from 2)
WHERE "phone" ~ '^01[3-9][0-9]{8}$';
