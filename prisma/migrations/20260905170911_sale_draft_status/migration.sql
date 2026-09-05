-- CreateEnum
CREATE TYPE "public"."SaleStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- AlterTable
ALTER TABLE "public"."Sale" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "public"."SaleStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "Sale_status_saleDate_idx" ON "public"."Sale"("status", "saleDate");
