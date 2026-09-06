-- Add reader profile to LibrarySetting
ALTER TABLE "LibrarySetting" ADD COLUMN "oracleProfile" TEXT;

-- Create OracleMessage table (conversation memory)
CREATE TABLE "OracleMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OracleMessage_pkey" PRIMARY KEY ("id")
);

-- Create index on userId
CREATE INDEX "OracleMessage_userId_idx" ON "OracleMessage"("userId");
