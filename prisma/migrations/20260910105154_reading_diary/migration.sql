CREATE TYPE "DiaryEntryType" AS ENUM ('REFLECTION', 'QUOTE', 'OCR');

CREATE TABLE "ReadingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "startedPage" INTEGER NOT NULL,
    "currentPage" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReadingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "sessionId" TEXT,
    "type" "DiaryEntryType" NOT NULL DEFAULT 'REFLECTION',
    "content" TEXT NOT NULL,
    "page" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ragEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReadingSession_userId_startedAt_idx" ON "ReadingSession"("userId", "startedAt");
CREATE INDEX "ReadingSession_bookId_startedAt_idx" ON "ReadingSession"("bookId", "startedAt");
CREATE INDEX "DiaryEntry_userId_createdAt_idx" ON "DiaryEntry"("userId", "createdAt");
CREATE INDEX "DiaryEntry_bookId_createdAt_idx" ON "DiaryEntry"("bookId", "createdAt");
CREATE INDEX "DiaryEntry_sessionId_idx" ON "DiaryEntry"("sessionId");
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReadingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
