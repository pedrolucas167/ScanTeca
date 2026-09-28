ALTER TABLE "OracleMessage" ADD COLUMN "requestId" TEXT;

CREATE UNIQUE INDEX "OracleMessage_userId_requestId_key"
ON "OracleMessage"("userId", "requestId");
