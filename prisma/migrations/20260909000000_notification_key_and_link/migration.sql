-- AlterTable
ALTER TABLE "public"."Notification" ADD COLUMN     "key" TEXT,
ADD COLUMN     "link" TEXT;

-- CreateIndex
CREATE INDEX "Notification_userId_readStatus_createdAt_idx" ON "public"."Notification"("userId", "readStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_key_key" ON "public"."Notification"("userId", "key");

