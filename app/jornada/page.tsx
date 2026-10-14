import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getJourney, HEAT_WEEKS } from "@/modules/reading";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  BookMarked,
  Flame,
  Gauge,
  Layers,
  Timer,
  Medal,
  Trophy,
  ArrowRight,
} from "lucide-react";
import GoalCard from "./GoalCard";
import QuickLog from "./QuickLog";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  READ: "Lido",
  READING: "Lendo",
  TO_READ: "A ler",
  WISHLIST: "Desejo",
};

export default async function JornadaPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { reading, readThisYear, queue, setting, year, pagesRead, pace, avgDays,
    streak, bestStreak, heatmap, recentNotes } = await getJourney(userId);
  const badges = [
    { days: 7, label: "Semana de fogo", icon: Flame },
    { days: 30, label: "Mês imparável", icon: Medal },
    { days: 100, label: "Centurião", icon: Trophy },
  ];

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
        {setting?.shareEnabled && setting.shareId && (
          <Link
            href={`/shared/${setting.shareId}/jornada`}
            className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Ver página pública da sua jornada →
          </Link>
        )}
      </section>

      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
            <Timer className="mx-auto h-5 w-5 text-orange-600 dark:text-orange-400" />
            <p className="mt-2 font-serif text-3xl font-semibold text-foreground">
              {avgDays !== null ? `${avgDays}d` : "—"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tempo médio por livro
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
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Conquistas
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Recorde: {bestStreak} {bestStreak === 1 ? "dia" : "dias"} seguidos
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {badges.map((b) => {
              const unlocked = bestStreak >= b.days;
              const Icon = b.icon;
              return (
                <div
                  key={b.days}
                  className={`rounded-lg border p-3 text-center ${
                    unlocked
                      ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
                      : "border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-700 dark:bg-zinc-800/50"
                  }`}
                >
                  <Icon
                    className={`mx-auto h-6 w-6 ${
                      unlocked
                        ? "text-amber-500 dark:text-amber-400"
                        : "text-zinc-400 dark:text-zinc-600"
                    }`}
                  />
                  <p className="mt-1 text-xs font-semibold text-foreground">
                    {b.label}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {unlocked
                      ? `${b.days} dias seguidos`
                      : `Faltam ${b.days - bestStreak} dias`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <GoalCard
            initialGoal={setting?.yearlyGoal ?? null}
            readCount={readThisYear.length}
            year={year}
          />
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 font-serif text-lg font-semibold text-foreground">
            Mapa de leitura
          </h2>
          <div className="overflow-x-auto">
            <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
              {heatmap.map(({ day: key, label, pages: p }) => {
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
                    title={`${label}: ${p} ${p === 1 ? "página" : "páginas"}`}
                    className={`h-3 w-3 rounded-sm ${cls}`}
                  />
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
            Últimas {HEAT_WEEKS} semanas · tons mais fortes = mais páginas no dia
          </p>
        </div>

        {recentNotes.length > 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="mb-3 font-serif text-lg font-semibold text-foreground">
              Notas de leitura
            </h2>
            <ul className="space-y-3">
              {recentNotes.map((l) => (
                <li
                  key={l.id}
                  className="border-l-2 border-indigo-300 pl-3 dark:border-indigo-700"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    {l.label}
                    {l.bookTitle ? ` · ${l.bookTitle}` : ""}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-300">
                    {l.note}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

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
            <>
              <div className="mb-4">
                <QuickLog
                  books={reading.map((b) => ({
                    id: b.id,
                    title: b.title,
                    currentPage: b.currentPage,
                    pages: b.pages,
                  }))}
                />
              </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reading.map((b) => {
                const { percentage: pct, days, etaDays } = b.progress;
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
                      {etaDays !== null && etaDays > 0 && (
                        <p className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          Nesse ritmo, termina em ~{etaDays}{" "}
                          {etaDays === 1 ? "dia" : "dias"}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
            </>
          )}
        </div>

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
