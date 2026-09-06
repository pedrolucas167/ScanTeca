import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, BookMarked, Flame, Target } from "lucide-react";

export const dynamic = "force-dynamic";

const HEAT_WEEKS = 15;

export default async function SharedJornadaPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;

  const setting = await prisma.librarySetting.findUnique({
    where: { shareId },
  });

  if (!setting || !setting.shareEnabled) {
    notFound();
  }

  const [books, logs] = await Promise.all([
    prisma.book.findMany({
      where: { userId: setting.userId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.readingLog.findMany({
      where: { userId: setting.userId },
      select: { date: true, pages: true },
    }),
  ]);

  const now = new Date();
  const year = now.getFullYear();

  const reading = books.filter((b) => b.status === "READING");
  const readThisYear = books.filter((b) => {
    if (b.status !== "READ") return false;
    const d = b.finishedAt ?? b.createdAt;
    return d.getFullYear() === year;
  });

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekPages = logs
    .filter((l) => l.date >= weekAgo)
    .reduce((s, l) => s + l.pages, 0);

  // Streak: dias seguidos com leitura (hoje ou terminando ontem)
  const logDays = new Set(logs.map((l) => l.date.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!logDays.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (logDays.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Heatmap das últimas 15 semanas
  const pagesByDay = new Map<string, number>();
  for (const l of logs) {
    const key = l.date.toISOString().slice(0, 10);
    pagesByDay.set(key, (pagesByDay.get(key) ?? 0) + l.pages);
  }
  const heatEnd = new Date();
  heatEnd.setHours(0, 0, 0, 0);
  heatEnd.setDate(heatEnd.getDate() + (6 - heatEnd.getDay()));
  const heatStart = new Date(heatEnd);
  heatStart.setDate(heatStart.getDate() - (HEAT_WEEKS * 7 - 1));

  const goalPct =
    setting.yearlyGoal && setting.yearlyGoal > 0
      ? Math.min(100, Math.round((readThisYear.length / setting.yearlyGoal) * 100))
      : null;

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-zinc-200 bg-gradient-to-br from-indigo-50/60 via-white to-amber-50/40 px-4 py-12 text-center dark:border-zinc-800 dark:from-indigo-950/20 dark:via-zinc-950 dark:to-amber-950/10">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">
          Iter Lectoris
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Jornada de {setting.name}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          {readThisYear.length}{" "}
          {readThisYear.length === 1 ? "livro lido" : "livros lidos"} em {year}
          {streak > 0 &&
            ` · ${streak} ${streak === 1 ? "dia" : "dias"} seguidos lendo`}
        </p>
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Compartilhado via Scanteca ·{" "}
          <Link
            href={`/shared/${shareId}`}
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Ver catálogo
          </Link>
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* Stats públicos */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <BookOpen className="mx-auto h-5 w-5 text-green-600 dark:text-green-400" />
            <p className="mt-2 font-serif text-3xl font-semibold text-foreground">
              {readThisYear.length}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Lidos em {year}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <BookMarked className="mx-auto h-5 w-5 text-amber-600 dark:text-amber-400" />
            <p className="mt-2 font-serif text-3xl font-semibold text-foreground">
              {reading.length}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Lendo agora
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <Flame className="mx-auto h-5 w-5 text-red-500 dark:text-red-400" />
            <p className="mt-2 font-serif text-3xl font-semibold text-foreground">
              {streak}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {streak === 1 ? "Dia seguido" : "Dias seguidos"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <Target className="mx-auto h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <p className="mt-2 font-serif text-3xl font-semibold text-foreground">
              {weekPages}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Páginas na semana
            </p>
          </div>
        </div>

        {/* Meta do ano (pública) */}
        {setting.yearlyGoal && goalPct !== null && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold text-foreground">
                Meta de {year}
              </h2>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {readThisYear.length} de {setting.yearlyGoal} livros · {goalPct}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
                style={{ width: `${goalPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Heatmap público */}
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 font-serif text-lg font-semibold text-foreground">
            Mapa de leitura
          </h2>
          <div className="overflow-x-auto">
            <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
              {Array.from({ length: HEAT_WEEKS * 7 }).map((_, i) => {
                const d = new Date(heatStart);
                d.setDate(d.getDate() + i);
                const key = d.toISOString().slice(0, 10);
                const p = pagesByDay.get(key) ?? 0;
                const cls =
                  p === 0
                    ? "bg-zinc-100 dark:bg-zinc-800"
                    : p < 15
                      ? "bg-emerald-200 dark:bg-emerald-900"
                      : p < 30
                        ? "bg-emerald-400 dark:bg-emerald-700"
                        : "bg-emerald-600 dark:bg-emerald-500";
                return (
                  <div
                    key={key}
                    title={`${d.toLocaleDateString("pt-BR")}: ${p} ${p === 1 ? "página" : "páginas"}`}
                    className={`h-3 w-3 rounded-sm ${cls}`}
                  />
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
            Últimas {HEAT_WEEKS} semanas · tons mais fortes = mais páginas no
            dia
          </p>
        </div>

        {/* Lendo agora (público) */}
        {reading.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 flex items-center gap-2 font-serif text-xl font-semibold text-foreground">
              <BookMarked className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Lendo agora
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reading.map((b) => {
                const pct =
                  b.pages && b.currentPage
                    ? Math.min(
                        100,
                        Math.round((b.currentPage / b.pages) * 100)
                      )
                    : 0;
                return (
                  <div
                    key={b.id}
                    className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                      {b.coverUrl ? (
                        <Image
                          src={b.coverUrl}
                          alt={`Capa de ${b.title}`}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BookOpen className="h-6 w-6 text-zinc-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                        {b.title}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {b.author}
                      </p>
                      {b.pages && b.currentPage ? (
                        <>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div
                              className="h-full rounded-full bg-amber-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                            {b.currentPage} de {b.pages} páginas · {pct}%
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 text-[10px] text-zinc-400">
                          Progresso não informado
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
