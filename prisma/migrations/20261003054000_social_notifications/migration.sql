CREATE TABLE "SocialNotification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialNotification_recipientId_createdAt_idx"
  ON "SocialNotification"("recipientId", "createdAt");
CREATE INDEX "SocialNotification_recipientId_readAt_idx"
  ON "SocialNotification"("recipientId", "readAt");
