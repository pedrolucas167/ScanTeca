CREATE TABLE "BookPassage" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapter" INTEGER,
    "paragraph" INTEGER,
    "textHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookPassage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "position" DOUBLE PRECISION,
    "type" TEXT NOT NULL DEFAULT 'comment',
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookPassage_bookId_chapter_paragraph_idx" ON "BookPassage"("bookId", "chapter", "paragraph");
CREATE INDEX "Annotation_passageId_idx" ON "Annotation"("passageId");
CREATE INDEX "Annotation_userId_idx" ON "Annotation"("userId");
CREATE INDEX "Annotation_sessionId_idx" ON "Annotation"("sessionId");

ALTER TABLE "BookPassage" ADD CONSTRAINT "BookPassage_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "BookPassage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
