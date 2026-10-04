CREATE TYPE "SocialProfileVisibility" AS ENUM ('PUBLIC', 'FOLLOWERS', 'PRIVATE');

CREATE TABLE "SocialProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "visibility" "SocialProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialFollow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialProfile_userId_key" ON "SocialProfile"("userId");
CREATE INDEX "SocialProfile_visibility_idx" ON "SocialProfile"("visibility");
CREATE UNIQUE INDEX "SocialFollow_followerId_followingId_key" ON "SocialFollow"("followerId", "followingId");
CREATE INDEX "SocialFollow_followerId_idx" ON "SocialFollow"("followerId");
CREATE INDEX "SocialFollow_followingId_idx" ON "SocialFollow"("followingId");
