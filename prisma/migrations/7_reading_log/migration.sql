-- Log diário de leitura: alimenta o streak (dias seguidos lendo)
CREATE TABLE "ReadingLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT,
    "date" DATE NOT NULL,
    "pages" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReadingLog_userId_date_key" ON "ReadingLog"("userId", "date");
CREATE INDEX "ReadingLog_userId_idx" ON "ReadingLog"("userId");
