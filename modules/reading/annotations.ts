import { prisma } from "@/lib/prisma";
import { annotationSchema, passageCommentSchema } from "./contracts";
import type { AnnotationInput } from "./contracts";
import { readingTransaction } from "./transaction";
import { ReadingError } from "./transitions";

export async function createAnnotation(userId: string, input: AnnotationInput) {
  const parsed = annotationSchema.safeParse(input);
  if (!parsed.success) throw new ReadingError("Anotação inválida");
  const data = parsed.data;
  return readingTransaction(async tx => {
    const book = await tx.book.findFirst({ where: { id: data.bookId, userId } });
    if (!book) throw new ReadingError("Livro não encontrado", "NOT_FOUND");
    if (data.sessionId) {
      const session = await tx.readingSession.findFirst({ where: { id: data.sessionId, userId, bookId: data.bookId } });
      if (!session) throw new ReadingError("Sessão não encontrada", "NOT_FOUND");
    }
    const chapter = data.chapter ?? 0;
    const id = `${data.bookId}-c${chapter}-p${data.paragraph}`;
    const passage = await tx.bookPassage.upsert({
      where: { id }, update: {}, create: { id, bookId: data.bookId, chapter, paragraph: data.paragraph },
    });
    return tx.annotation.create({ data: {
      passageId: passage.id, userId, content: data.content, position: data.position, type: data.type, sessionId: data.sessionId,
    } });
  });
}

export async function addPassageComment(userId: string, input: { bookId: string; passageId: string; content: unknown }) {
  const parsed = passageCommentSchema.safeParse(input);
  if (!parsed.success) throw new ReadingError("Anotação inválida");
  const { bookId, passageId, content } = parsed.data;
  return readingTransaction(async tx => {
    const passage = await tx.bookPassage.findFirst({ where: { id: passageId, bookId, book: { userId } } });
    if (!passage) throw new ReadingError("Trecho não encontrado", "NOT_FOUND");
    return tx.annotation.create({ data: { passageId, userId, content, type: "comment" } });
  });
}

export async function getReadingPage(userId: string, bookId: string) {
  const book = await prisma.book.findFirst({ where: { id: bookId, userId } });
  if (!book) return null;
  const passage = await prisma.bookPassage.findFirst({ where: { bookId }, orderBy: { chapter: "asc", paragraph: "asc" } });
  const annotations = passage ? await prisma.annotation.findMany({
    where: { passageId: passage.id, userId }, orderBy: { createdAt: "desc" },
  }) : [];
  return { book, passage, annotations };
}
