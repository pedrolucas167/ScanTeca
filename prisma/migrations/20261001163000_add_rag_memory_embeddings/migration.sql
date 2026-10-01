ALTER TABLE "DiaryEntry" ADD COLUMN "embedding" vector(1536);
ALTER TABLE "Review" ADD COLUMN "embedding" vector(1536);

CREATE INDEX "DiaryEntry_embedding_hnsw_idx"
ON "DiaryEntry" USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX "Review_embedding_hnsw_idx"
ON "Review" USING hnsw ("embedding" vector_cosine_ops);
