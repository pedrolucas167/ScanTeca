-- Create LibrarySetting table
CREATE TABLE "LibrarySetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Minha Biblioteca',

    CONSTRAINT "LibrarySetting_pkey" PRIMARY KEY ("id")
);

-- Create unique index on userId
CREATE UNIQUE INDEX "LibrarySetting_userId_key" ON "LibrarySetting"("userId");
