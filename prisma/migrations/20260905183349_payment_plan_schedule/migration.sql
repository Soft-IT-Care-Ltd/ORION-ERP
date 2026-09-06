-- DropForeignKey
ALTER TABLE "public"."Installment" DROP CONSTRAINT "Installment_paymentPlanId_fkey";

-- AlterTable
ALTER TABLE "public"."Installment" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "percentage" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "public"."PaymentPlan" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Installment_paymentPlanId_order_idx" ON "public"."Installment"("paymentPlanId", "order");

-- CreateIndex
CREATE INDEX "Installment_status_dueDate_idx" ON "public"."Installment"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Installment_dueDate_idx" ON "public"."Installment"("dueDate");

-- CreateIndex
CREATE INDEX "Payment_installmentId_paidAt_idx" ON "public"."Payment"("installmentId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "public"."Payment"("paidAt");

-- AddForeignKey
ALTER TABLE "public"."Installment" ADD CONSTRAINT "Installment_paymentPlanId_fkey" FOREIGN KEY ("paymentPlanId") REFERENCES "public"."PaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
