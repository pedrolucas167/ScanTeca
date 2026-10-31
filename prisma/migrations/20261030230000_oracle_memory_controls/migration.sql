ALTER TABLE "LibrarySetting"
ADD COLUMN "oracleMemoryEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "oracleProfileVersion" INTEGER NOT NULL DEFAULT 0;
