import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findSynopsis } from "@/lib/synopsis";
import { findOriginalPublishYear, extractYear } from "@/lib/original-date";
import { invalidateRecommendationsCache } from "@/lib/recommendations-cache";
import { fetchGoogleBooksFields } from "./enrichment-provider";
import type { EnrichResult } from "./enrichment-provider";
import { libraryTransaction } from "./transaction";
import { LibraryError } from "./errors";
import { refreshBookEmbedding } from "./indexing";

export const enrichSchema = z.object({ bookId: z.string().nullish() });

export async function enrichBooks(userId: string, bookId?: string | null) {
  const candidates = await prisma.book.findMany({ where: { userId, ...(bookId ? { id: bookId } : {}) }, orderBy: { title: "asc" } });
  if (bookId && !candidates.length) throw new LibraryError("NOT_FOUND", "Livro não encontrado");
  const books = bookId ? candidates : candidates.filter(book => !book.synopsis?.trim() || !book.genre || !book.pages);
  const results: EnrichResult[] = [];
  for (const [index, snapshot] of books.entries()) {
    const proposal: EnrichResult["values"] = {};
    if (!snapshot.synopsis?.trim() || !snapshot.genre || !snapshot.pages) {
      const fields = await fetchGoogleBooksFields(snapshot);
      if (fields.synopsis) proposal.synopsis = fields.synopsis;
      if (fields.genre) proposal.genre = fields.genre;
      if (fields.pages && fields.pages > 0) proposal.pages = fields.pages;
    }
    if (!snapshot.synopsis?.trim() && !proposal.synopsis) {
      const synopsis = await findSynopsis({ title: snapshot.title, author: snapshot.author, isbn: snapshot.isbn });
      if (synopsis) proposal.synopsis = synopsis;
    }
    const original = await findOriginalPublishYear({ title: snapshot.title, author: snapshot.author, isbn: snapshot.isbn });
    if (original && (!extractYear(snapshot.publishedDate) || original < extractYear(snapshot.publishedDate)!)) proposal.publishedDate = String(original);

    const result = await libraryTransaction(async tx => {
      const current = await tx.book.findFirst({ where: { id: snapshot.id, userId } });
      if (!current) throw new LibraryError("NOT_FOUND", "Livro não encontrado");
      const values: EnrichResult["values"] = {};
      // Discard provider results if the identity was edited while awaiting it.
      if (current.title === snapshot.title && current.author === snapshot.author && current.isbn === snapshot.isbn) {
        if (!current.synopsis?.trim() && proposal.synopsis) values.synopsis = proposal.synopsis;
        if (!current.genre && proposal.genre) values.genre = proposal.genre;
        if (!current.pages && proposal.pages) values.pages = proposal.pages;
        if (current.publishedDate === snapshot.publishedDate && proposal.publishedDate) values.publishedDate = proposal.publishedDate;
      }
      const book = Object.keys(values).length ? await tx.book.update({ where: { id: current.id, userId }, data: values }) : current;
      if (values.synopsis || values.genre) await tx.$executeRaw`UPDATE "Book" SET embedding = NULL WHERE id = ${book.id} AND "userId" = ${userId}`;
      return { book, values };
    });
    if (Object.keys(result.values).length) {
      await invalidateRecommendationsCache(userId);
      if (result.values.synopsis || result.values.genre) await refreshBookEmbedding(result.book);
    }
    results.push({ id: result.book.id, title: result.book.title, updated: Object.keys(result.values), values: result.values });
    if (!bookId && index < books.length - 1) await new Promise(resolve => setTimeout(resolve, 400));
  }
  return { total: books.length, enriched: results.filter(result => result.updated.length).length, results };
}
