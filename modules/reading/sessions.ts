import { readingTransaction } from "./transaction";
import { planReadingTransition, ReadingError } from "./transitions";
import { recordDailyProgress } from "./progress";

export async function startReadingSession(userId: string, bookId: string) {
  return readingTransaction(async tx => {
    const book = await tx.book.findFirst({ where: { id: bookId, userId } });
    if (!book) throw new ReadingError("Livro não encontrado", "NOT_FOUND");
    const active = await tx.readingSession.findFirst({ where: { userId, endedAt: null } });
    // A retried start for the same book must not close and recreate the timer.
    if (active?.bookId === bookId) return active;
    const now = new Date();
    await tx.readingSession.updateMany({ where: { userId, endedAt: null }, data: { endedAt: now } });
    const session = await tx.readingSession.create({ data: {
      userId, bookId, startedPage: book.currentPage ?? 0, currentPage: book.currentPage ?? 0,
    } });
    const transition = planReadingTransition(book, { status: "READING" }, now);
    if (Object.keys(transition.data).length) {
      await tx.book.update({ where: { id: bookId, userId }, data: transition.data });
    }
    return session;
  });
}

export async function pauseReadingSession(userId: string, sessionId: string, currentPage: number) {
  return readingTransaction(async tx => {
    const session = await tx.readingSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new ReadingError("Sessão ativa não encontrada", "NOT_FOUND");
    if (session.endedAt) {
      if (session.currentPage !== currentPage) throw new ReadingError("Sessão já encerrada", "CONFLICT");
      return { ok: true, durationSec: session.durationSec ?? 0, pages: session.currentPage - session.startedPage };
    }
    const book = await tx.book.findFirst({ where: { id: session.bookId, userId } });
    if (!book) throw new ReadingError("Livro não encontrado", "NOT_FOUND");
    if (book.pages != null && currentPage > book.pages) {
      throw new ReadingError(`A página não pode ultrapassar ${book.pages}`);
    }
    if (currentPage < session.startedPage) {
      throw new ReadingError(`A página não pode ser menor que ${session.startedPage}, onde a sessão começou`);
    }
    const endedAt = new Date();
    const durationSec = Math.max(0, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000));
    await tx.readingSession.update({ where: { id: sessionId, userId }, data: { endedAt, durationSec, currentPage } });
    // Another entry point may already have recorded part of this session.
    const effectivePage = Math.max(currentPage, book.currentPage ?? 0);
    await tx.book.update({ where: { id: book.id, userId }, data: { currentPage: effectivePage } });
    await recordDailyProgress(tx, { userId, bookId: book.id, pages: Math.max(0, currentPage - (book.currentPage ?? 0)) });
    return { ok: true, durationSec, pages: currentPage - session.startedPage };
  });
}
