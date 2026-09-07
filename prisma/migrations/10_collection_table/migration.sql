-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- Backfill: uma Collection por (userId, nome) distinto existente em Book.collection
INSERT INTO "Collection" ("id", "userId", "name", "createdAt")
SELECT gen_random_uuid()::text, b."userId", b."collection", NOW()
FROM (SELECT DISTINCT "userId", "collection" FROM "Book") b;

-- Garante que o nome da biblioteca de cada usuário exista como coleção,
-- mesmo sem livros (é o destino default de novos livros)
INSERT INTO "Collection" ("id", "userId", "name", "createdAt")
SELECT gen_random_uuid()::text, s."userId", s."name", NOW()
FROM "LibrarySetting" s
WHERE NOT EXISTS (
    SELECT 1 FROM "Collection" c
    WHERE c."userId" = s."userId" AND c."name" = s."name"
);

-- AddColumn + backfill da FK
ALTER TABLE "Book" ADD COLUMN "collectionId" TEXT;

UPDATE "Book" b SET "collectionId" = c."id"
FROM "Collection" c
WHERE c."userId" = b."userId" AND c."name" = b."collection";

ALTER TABLE "Book" ALTER COLUMN "collectionId" SET NOT NULL;

-- DropColumn (o índice Book_collection_idx cai junto com a coluna)
ALTER TABLE "Book" DROP COLUMN "collection";

-- CreateIndex
CREATE UNIQUE INDEX "Collection_userId_name_key" ON "Collection"("userId", "name");
CREATE INDEX "Collection_userId_idx" ON "Collection"("userId");
CREATE INDEX "Book_collectionId_idx" ON "Book"("collectionId");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
