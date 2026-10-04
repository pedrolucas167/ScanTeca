CREATE TABLE "SocialBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialBlock_blockerId_blockedId_key"
  ON "SocialBlock"("blockerId", "blockedId");
CREATE INDEX "SocialBlock_blockedId_idx" ON "SocialBlock"("blockedId");
CREATE UNIQUE INDEX "SocialReport_reporterId_targetType_targetId_key"
  ON "SocialReport"("reporterId", "targetType", "targetId");
CREATE INDEX "SocialReport_targetType_targetId_idx"
  ON "SocialReport"("targetType", "targetId");
CREATE INDEX "SocialReport_status_createdAt_idx"
  ON "SocialReport"("status", "createdAt");
