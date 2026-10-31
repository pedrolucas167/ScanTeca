import { prisma } from "@/lib/prisma";
import { listOracleSessions, OracleSessionError } from "./session";
import { listOracleArtifacts } from "./artifacts";

export async function getOracleHome(userId: string, sessionId: string | null) {
  if (sessionId) {
    const ownsSession = await prisma.oracleSession.count({
      where: { id: sessionId, userId },
    });
    if (!ownsSession) {
      throw new OracleSessionError("NOT_FOUND");
    }
  }

  const [desc, books, bookStats, setting, sessions, artifacts] = await Promise.all([
    prisma.oracleMessage.findMany({
      where: sessionId ? { userId, sessionId } : { userId, sessionId: null },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.$queryRaw<
      { title: string; author: string; genre: string | null }[]
    >`
      SELECT title, author, genre
      FROM "Book"
      WHERE "userId" = ${userId}
      ORDER BY CASE status WHEN 'READ' THEN 0 WHEN 'TO_READ' THEN 1 ELSE 2 END,
               RANDOM()
      LIMIT 4
    `,
    prisma.$queryRaw<{ total: bigint; indexed: bigint }[]>`
      SELECT COUNT(*) AS total,
             COUNT(embedding) AS indexed
      FROM "Book"
      WHERE "userId" = ${userId}
    `,
    prisma.librarySetting.findUnique({
      where: { userId },
      select: { oracleProfile: true },
    }),
    listOracleSessions(userId),
    listOracleArtifacts(userId),
  ]);

  const stats = {
    total: Number(bookStats[0]?.total ?? 0),
    indexed: Number(bookStats[0]?.indexed ?? 0),
  };

  const suggestions: string[] = [];
  if (books[0]) suggestions.push(`O que ler depois de ${books[0].title}?`);
  if (books[1])
    suggestions.push(`Me recomende algo parecido com ${books[1].title}`);
  const genre = books.find((b) => b.genre)?.genre;
  if (genre) suggestions.push(`O que eu tenho de ${genre}?`);
  else if (books[2])
    suggestions.push(`O que você acha de ${books[2].author}?`);
  if (suggestions.length === 0) {
    suggestions.push(
      "Quais livros eu tenho no meu acervo?",
      "Me recomende um livro para ler agora",
      "Por onde eu começo?"
    );
  }

  return { messages: desc.reverse(), suggestions, stats, profile: setting?.oracleProfile ?? null,
    sessions, artifacts, activeSessionId: sessionId };
}

export function clearOracleHistory(userId: string) {
  return prisma.oracleMessage.deleteMany({ where: { userId } });
}
