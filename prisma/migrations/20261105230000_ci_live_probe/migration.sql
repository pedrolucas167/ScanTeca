-- Temporary CI probe, only applied in the disposable Actions database.
CREATE TABLE "MigrationCiLiveProbe" (
  "id" INTEGER NOT NULL,
  CONSTRAINT "MigrationCiLiveProbe_pkey" PRIMARY KEY ("id")
);
