-- Create enum type for BookStatus
CREATE TYPE "BookStatus" AS ENUM ('READ', 'TO_READ', 'WISHLIST');

-- Add new columns to Book table
ALTER TABLE "Book" ADD COLUMN "status" "BookStatus" NOT NULL DEFAULT 'TO_READ';
ALTER TABLE "Book" ADD COLUMN "collection" TEXT NOT NULL DEFAULT 'Minha Biblioteca';
ALTER TABLE "Book" ADD COLUMN "notes" TEXT;
ALTER TABLE "Book" ADD COLUMN "rating" INTEGER;

-- Add indexes
CREATE INDEX "Book_status_idx" ON "Book"("status");
CREATE INDEX "Book_collection_idx" ON "Book"("collection");
