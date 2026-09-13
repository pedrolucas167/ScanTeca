-- Progresso de leitura: status "Lendo" + página atual e datas de início/fim
ALTER TYPE "BookStatus" ADD VALUE 'READING';

ALTER TABLE "Book" ADD COLUMN "currentPage" INTEGER;
ALTER TABLE "Book" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Book" ADD COLUMN "finishedAt" TIMESTAMP(3);
