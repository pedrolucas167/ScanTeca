CREATE TABLE "OracleSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'EXPLORE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OracleSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OracleArtifact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OracleArtifact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OracleMessage" ADD COLUMN "sessionId" TEXT;

CREATE INDEX "OracleSession_userId_updatedAt_idx" ON "OracleSession"("userId", "updatedAt");
CREATE INDEX "OracleArtifact_userId_updatedAt_idx" ON "OracleArtifact"("userId", "updatedAt");
CREATE INDEX "OracleArtifact_sessionId_idx" ON "OracleArtifact"("sessionId");
CREATE INDEX "OracleMessage_sessionId_idx" ON "OracleMessage"("sessionId");

ALTER TABLE "OracleMessage" ADD CONSTRAINT "OracleMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OracleSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OracleArtifact" ADD CONSTRAINT "OracleArtifact_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OracleSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
