import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  BookMarked,
  Flame,
  Gauge,
  Layers,
  ArrowRight,
} from "lucide-react";
import GoalCard from "./GoalCard";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  READ: "Lido",
  READING: "Lendo",
  TO_READ: "A ler",
  WISHLIST: "Desejo",
};

function daysBetween(a: Date, b: Date) {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
}

export default async function JornadaPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [books, setting] = await Promise.all([
    prisma.book.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.librarySetting.findUnique({ where: { userId } }),
  ]);

  const now = new Date();
  const year = now.getFullYear();

  const reading = books.filter((b) => b.status === "READING");
  const read = books.filter((b) => b.status === "READ");
  // finishedAt só existe pra leituras novas — createdAt como proxy pros legados
  const readThisYear = read.filter((b) => {
    const d = b.finishedAt ?? b.createdAt;
    return d.getFullYear() === year;
  });
  const queue = books
    .filter((b) => b.status === "TO_READ")
    .slice(0, 6);

  const pagesRead =
    read.reduce((s, b) => s + (b.pages ?? 0), 0) +
    reading.reduce((s, b) => s + (b.currentPage ?? 0), 0);

  // Ritmo: média de páginas/dia dos livros com início e fim registrados
  const paced = read.filter((b) => b.startedAt && b.finishedAt && b.pages);
  const pace =
    paced.length > 0
      ? Math.round(
          paced.reduce(
            (s, b) => s + b.pages! / daysBetween(b.startedAt!, b.finishedAt!),
            0
          ) / paced.length
        )
      : null;

  const avgDays =
    paced.length > 0
      ? Math.round(
          paced.reduce(
            (s, b) => s + daysBetween(b.startedAt!, b.finishedAt!),
            0
          ) / paced.length
        )
      : null;

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-zinc-200 bg-gradient-to-br from-indigo-50/60 via-white to-amber-50/40 px-4 py-12 text-center dark:border-zinc-800 dark:from-indigo-950/20 dark:via-zinc-950 dark:to-amber-950/10">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">
          Iter Lectoris
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Sua Jornada
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          Ler mais e melhor: acompanhe o ritmo, termine o que começou e mantenha
          a fila andando.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* Stats do ano */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <BookOpen className="mx-auto h-5 w-5 text-green-600 dark:text-green-400" />
            <p className="mt-2 font-serif text-3xl font-semibold text-foreground">
              {readThisYear.length}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {readThisYear.length === 1 ? "Lido" : "Lidos"} em {year}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <Layers className="mx-auto h-5 w-5 text-amber-600 dark:text-amber-400" />
            <p className="mt-2 font-serif text-3xl font-semibold text-foreground">
              {pagesRead.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Páginas lidas
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <Gauge className="mx-auto h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <p className="mt-2 font-serif text-3xl font-semibold text-foreground">
              {pace !== null ? `${pace}` : "—"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Páginas/dia (média)
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <Flame className="mx-auto h-5 w-5 text-orange-600 dark:text-orange-400" />
            <p className="mt-2 font-serif text-3xl font-semibold text-foreground">
              {avgDays !== null ? `${avgDays}d` : "—"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tempo médio por livro
            </p>
          </div>
        </div>

        {/* Meta do ano */}
        <div className="mt-6">
          <GoalCard
            initialGoal={setting?.yearlyGoal ?? null}
            readCount={readThisYear.length}
            year={year}
          />
        </div>

        {/* Lendo agora */}
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-foreground">
              <BookMarked className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Lendo agora
            </h2>
            <Link
              href="/"
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Ver no catálogo
            </Link>
          </div>

          {reading.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white/50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nenhuma leitura em andamento. Marque um livro como{" "}
                <strong>Lendo</strong> no catálogo para acompanhar aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reading.map((b) => {
                const pct =
                  b.pages && b.currentPage
                    ? Math.min(100, Math.round((b.currentPage / b.pages) * 100))
                    : 0;
                const days = b.startedAt ? daysBetween(b.startedAt, now) : null;
                return (
                  <Link
                    key={b.id}
                    href={`/books/${b.id}`}
                    className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
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
                          <BookOpen className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
                        {b.title}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {b.author}
                      </p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                        {b.pages
                          ? `${b.currentPage ?? 0} de ${b.pages} páginas · ${pct}%`
                          : "Progresso não informado"}
                        {days !== null &&
                          ` · há ${days} ${days === 1 ? "dia" : "dias"}`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Fila */}
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-foreground">
              Próximos da fila
            </h2>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Catálogo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {queue.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Fila vazia — adicione livros com status <strong>A ler</strong>.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
              {queue.map((b) => (
                <Link
                  key={b.id}
                  href={`/books/${b.id}`}
                  title={`${b.title} — ${statusLabels[b.status]}`}
                  className="group"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-100 shadow-sm transition-shadow group-hover:shadow-md dark:bg-zinc-800">
                    {b.coverUrl ? (
                      <Image
                        src={b.coverUrl}
                        alt={`Capa de ${b.title}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 33vw, 16vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center">
                        <span className="line-clamp-3 text-[10px] font-medium text-zinc-400">
                          {b.title}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
