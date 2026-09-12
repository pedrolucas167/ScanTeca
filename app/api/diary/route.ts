import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), bookId: z.string().cuid() }),
  z.object({ action: z.literal("pause"), sessionId: z.string().cuid(), currentPage: z.number().int().min(0) }),
  z.object({
    action: z.literal("entry"),
    bookId: z.string().cuid(),
    sessionId: z.string().cuid().nullable().optional(),
    type: z.enum(["REFLECTION", "QUOTE", "OCR"]),
    content: z.string().trim().min(1).max(5000),
    page: z.number().int().min(1).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  }),
  z.object({
    action: z.literal("updateEntry"),
    entryId: z.string().cuid(),
    type: z.enum(["REFLECTION", "QUOTE", "OCR"]),
    content: z.string().trim().min(1).max(5000),
    page: z.number().int().min(1).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  }),
  z.object({ action: z.literal("deleteEntry"), entryId: z.string().cuid() }),
]);

async function validatePage(userId: string, bookId: string, page: number | null | undefined) {
  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
    select: { pages: true },
  });
  if (!book) return { error: "Livro não encontrado", status: 404 } as const;
  if (page != null && book.pages != null && page > book.pages) {
    return { error: `A página não pode ultrapassar ${book.pages}`, status: 400 } as const;
  }
  return { book } as const;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const rateLimit = await rateLimitGuard(request, {
    route: "diary",
    userId,
    ...rateLimits.diary,
  });
  if (rateLimit) return rateLimit;

  const parsed = await readJson(request, schema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  if (input.action === "start") {
    const book = await prisma.book.findFirst({ where: { id: input.bookId, userId } });
    if (!book) return Response.json({ error: "Livro não encontrado" }, { status: 404 });
    await prisma.readingSession.updateMany({
      where: { userId, endedAt: null },
      data: { endedAt: new Date() },
    });
    const session = await prisma.readingSession.create({
      data: { userId, bookId: book.id, startedPage: book.currentPage ?? 0, currentPage: book.currentPage ?? 0 },
    });
    if (book.status !== "READING") {
      await prisma.book.update({ where: { id: book.id }, data: { status: "READING", startedAt: book.startedAt ?? new Date() } });
    }
    return Response.json({ session }, { status: 201 });
  }

  if (input.action === "pause") {
    const session = await prisma.readingSession.findFirst({ where: { id: input.sessionId, userId, endedAt: null } });
    if (!session) return Response.json({ error: "Sessão ativa não encontrada" }, { status: 404 });
    const pageCheck = await validatePage(userId, session.bookId, input.currentPage);
    if ("error" in pageCheck) return Response.json({ error: pageCheck.error }, { status: pageCheck.status });
    if (input.currentPage < session.startedPage) {
      return Response.json({ error: `A página não pode ser menor que ${session.startedPage}, onde a sessão começou` }, { status: 400 });
    }
    const endedAt = new Date();
    const durationSec = Math.max(0, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000));
    const currentPage = input.currentPage;
    const pages = currentPage - session.startedPage;
    await prisma.$transaction([
      prisma.readingSession.update({ where: { id: session.id }, data: { endedAt, durationSec, currentPage } }),
      prisma.book.update({ where: { id: session.bookId }, data: { currentPage } }),
      ...(pages > 0 ? [prisma.readingLog.upsert({
        where: { userId_date: { userId, date: new Date(new Date().toISOString().slice(0, 10)) } },
        create: { userId, bookId: session.bookId, date: new Date(new Date().toISOString().slice(0, 10)), pages },
        update: { pages: { increment: pages }, bookId: session.bookId },
      })] : []),
    ]);
    return Response.json({ ok: true, durationSec, pages });
  }

  if (input.action === "deleteEntry") {
    const entry = await prisma.diaryEntry.findFirst({ where: { id: input.entryId, userId } });
    if (!entry) return Response.json({ error: "Anotação não encontrada" }, { status: 404 });
    await prisma.diaryEntry.delete({ where: { id: entry.id } });
    return Response.json({ ok: true });
  }

  if (input.action === "updateEntry") {
    const entry = await prisma.diaryEntry.findFirst({ where: { id: input.entryId, userId } });
    if (!entry) return Response.json({ error: "Anotação não encontrada" }, { status: 404 });
    const pageCheck = await validatePage(userId, entry.bookId, input.page);
    if ("error" in pageCheck) return Response.json({ error: pageCheck.error }, { status: pageCheck.status });
    const updated = await prisma.diaryEntry.update({
      where: { id: entry.id },
      data: { type: input.type, content: input.content, page: input.page, tags: input.tags },
      include: { book: { select: { title: true, author: true } } },
    });
    return Response.json({ entry: updated });
  }

  const book = await prisma.book.count({ where: { id: input.bookId, userId } });
  if (!book) return Response.json({ error: "Livro não encontrado" }, { status: 404 });
  if (input.sessionId) {
    const session = await prisma.readingSession.count({ where: { id: input.sessionId, userId, bookId: input.bookId } });
    if (!session) return Response.json({ error: "Sessão não encontrada" }, { status: 404 });
  }
  const pageCheck = await validatePage(userId, input.bookId, input.page);
  if ("error" in pageCheck) return Response.json({ error: pageCheck.error }, { status: pageCheck.status });
  const entry = await prisma.diaryEntry.create({
    data: { userId, bookId: input.bookId, sessionId: input.sessionId, type: input.type, content: input.content, page: input.page, tags: input.tags },
  });
  return Response.json({ entry }, { status: 201 });
}
