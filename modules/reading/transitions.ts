export type ReadingStatus = "READ" | "READING" | "TO_READ" | "WISHLIST";

export interface ReadingState {
  status: ReadingStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  currentPage: number | null;
  readCount: number;
  reclubeCount: number;
}

export interface ReadingChange {
  status?: ReadingStatus | null;
  currentPage?: number | null;
  startReclube?: boolean;
}

export class ReadingError extends Error {}

export function planReadingTransition(
  existing: ReadingState,
  change: ReadingChange,
  now = new Date(),
) {
  const data: Partial<ReadingState> & { reclubeStartedAt?: Date } = {};
  if (change.currentPage !== undefined) data.currentPage = change.currentPage;

  // Repeating READ is an edit, not another completed reading.
  if (change.status && change.status !== existing.status) {
    data.status = change.status;
    data.finishedAt = null;
    if (change.status === "READING" || change.status === "READ") {
      data.startedAt = existing.startedAt ?? now;
    }
    if (change.status === "READ") {
      data.finishedAt = now;
      data.readCount = existing.readCount + 1;
    }
  }

  if (change.startReclube) {
    if (existing.status !== "READ") {
      throw new ReadingError("Só é possível iniciar reclube de livros já lidos");
    }
    data.status = "READING";
    data.reclubeCount = existing.reclubeCount + 1;
    data.reclubeStartedAt = now;
    data.startedAt = existing.startedAt ?? now;
    data.currentPage = 0;
    data.finishedAt = null;
  }

  const effectivePage = data.currentPage ?? 0;
  const pagesRead = change.currentPage === undefined || change.startReclube
    ? 0 : Math.max(0, effectivePage - (existing.currentPage ?? 0));
  const completed = data.status === "READ" && existing.status !== "READ";
  return { data, pagesRead, completed };
}
