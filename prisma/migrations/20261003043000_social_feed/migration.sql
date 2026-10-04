-- CreateTable
CREATE TABLE "FeedPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "content" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Reflexão compartilhada',
    "bookId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedBookmark" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedBookmark_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedPost_createdAt_idx" ON "FeedPost"("createdAt");
CREATE INDEX "FeedPost_userId_createdAt_idx" ON "FeedPost"("userId", "createdAt");
CREATE INDEX "FeedPost_bookId_idx" ON "FeedPost"("bookId");
CREATE INDEX "FeedComment_postId_createdAt_idx" ON "FeedComment"("postId", "createdAt");
CREATE INDEX "FeedComment_userId_idx" ON "FeedComment"("userId");
CREATE UNIQUE INDEX "FeedReaction_postId_userId_key" ON "FeedReaction"("postId", "userId");
CREATE INDEX "FeedReaction_userId_idx" ON "FeedReaction"("userId");
CREATE UNIQUE INDEX "FeedBookmark_postId_userId_key" ON "FeedBookmark"("postId", "userId");
CREATE INDEX "FeedBookmark_userId_idx" ON "FeedBookmark"("userId");

ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedComment" ADD CONSTRAINT "FeedComment_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedReaction" ADD CONSTRAINT "FeedReaction_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedBookmark" ADD CONSTRAINT "FeedBookmark_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
