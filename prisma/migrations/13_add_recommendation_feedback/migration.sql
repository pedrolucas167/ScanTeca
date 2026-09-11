-- CreateEnum
CREATE TYPE "RecommendationFeedbackKind" AS ENUM ('WANT', 'DISMISSED');

-- CreateTable
CREATE TABLE "RecommendationFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "normalizedAuthor" TEXT NOT NULL,
    "kind" "RecommendationFeedbackKind" NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationFeedback_userId_idx" ON "RecommendationFeedback"("userId");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_userId_kind_idx" ON "RecommendationFeedback"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationFeedback_userId_normalizedTitle_normalizedAut_key" ON "RecommendationFeedback"("userId", "normalizedTitle", "normalizedAuthor");
