import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPush } from "@/lib/push";
import { reportError } from "@/lib/error-report";

export const dynamic = "force-dynamic";

// Marcos de dias sem log que disparam lembrete — não é diário, evita spam.
const REMINDER_DAYS = new Set([3, 7, 14, 30]);

/**
 * Cron diário (vercel.json): lembra usuários com livro em andamento
 * que não registram páginas há N dias. Respeita a preferência "progress"
 * via sendPush. Protegido por CRON_SECRET (Vercel manda Bearer no header).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    // Só usuários com push inscrito podem receber lembrete.
    const subs = await prisma.pushSubscription.findMany({
      select: { userId: true },
      distinct: ["userId"],
    });
    const userIds = subs.map((s) => s.userId);
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, reminded: 0 });
    }

    const [lastLogs, readingBooks] = await Promise.all([
      prisma.readingLog.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _max: { date: true },
      }),
      prisma.book.findMany({
        where: { userId: { in: userIds }, status: "READING" },
        select: { userId: true, id: true, title: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const lastLogByUser = new Map(
      lastLogs.map((l) => [l.userId, l._max.date])
    );
    const readingByUser = new Map<string, { id: string; title: string }>();
    for (const b of readingBooks) {
      if (!readingByUser.has(b.userId)) {
        readingByUser.set(b.userId, { id: b.id, title: b.title });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let reminded = 0;

    await Promise.all(
      userIds.map(async (userId) => {
        const lastLog = lastLogByUser.get(userId);
        const book = readingByUser.get(userId);
        if (!lastLog || !book) return;

        const days = Math.round(
          (today.getTime() - lastLog.getTime()) / 86400000
        );
        if (!REMINDER_DAYS.has(days)) return;

        const result = await sendPush(
          {
            title: "Sua leitura sente sua falta",
            body: `Faz ${days} dias sem registrar páginas em "${book.title}". Bora continuar?`,
            url: `/books/${book.id}`,
          },
          { userId, category: "progress" }
        );
        if (result.sent > 0) reminded++;
      })
    );

    return NextResponse.json({ ok: true, reminded });
  } catch (error) {
    reportError("GET /api/cron/reading-reminder", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
