CREATE TABLE "BookDiscussion" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "quote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookDiscussion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookDiscussionReply" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "content" TEXT NOT NULL,
    "quote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookDiscussionReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookDiscussion_bookId_createdAt_idx" ON "BookDiscussion"("bookId", "createdAt");
CREATE INDEX "BookDiscussion_userId_idx" ON "BookDiscussion"("userId");
CREATE INDEX "BookDiscussionReply_discussionId_createdAt_idx" ON "BookDiscussionReply"("discussionId", "createdAt");
CREATE INDEX "BookDiscussionReply_userId_idx" ON "BookDiscussionReply"("userId");

ALTER TABLE "BookDiscussion" ADD CONSTRAINT "BookDiscussion_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookDiscussionReply" ADD CONSTRAINT "BookDiscussionReply_discussionId_fkey"
  FOREIGN KEY ("discussionId") REFERENCES "BookDiscussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
