import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import { BookOpen, Star } from "lucide-react";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  READ: "Lido",
  READING: "Lendo",
  TO_READ: "A ler",
  WISHLIST: "Desejo",
};

const statusClasses: Record<string, string> = {
  READ: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  READING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  TO_READ: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  WISHLIST:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

export default async function SharedCatalogPage({
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

  const books = await prisma.book.findMany({
    where: { userId: setting.userId },
    orderBy: { createdAt: "desc" },
    include: { collection: { select: { name: true } } },
  });

  const readCount = books.filter((b) => b.status === "READ").length;

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-zinc-200 bg-gradient-to-br from-amber-50/60 via-white to-indigo-50/40 px-4 py-14 text-center dark:border-zinc-800 dark:from-amber-950/10 dark:via-zinc-950 dark:to-indigo-950/20">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">
          Ex Libris
        </p>
        <h1 className="mt-2 flex items-center justify-center gap-3 font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          <BookOpen className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          {setting.name}
        </h1>
        <div className="mx-auto mt-5 flex max-w-xs items-center gap-3">
          <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
          <span className="font-serif text-sm italic text-zinc-400 dark:text-zinc-500">
            ❧
          </span>
          <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
        </div>
        <p className="mx-auto mt-4 max-w-lg font-serif text-base italic text-zinc-600 dark:text-zinc-400">
          {books.length} {books.length === 1 ? "volume" : "volumes"} ·{" "}
          {readCount} {readCount === 1 ? "lido" : "lidos"}
        </p>
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Compartilhado via Scanteca
        </p>
      </section>

      <section className="flex-1 px-4 py-8">
        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="mb-4 h-16 w-16 text-zinc-300 dark:text-zinc-700" />
            <h2 className="text-xl font-semibold text-foreground">
              Catálogo vazio
            </h2>
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {books.map((book) => (
              <article
                key={book.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="relative flex h-56 items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                  {book.coverUrl ? (
                    <Image
                      src={book.coverUrl}
                      alt={`Capa de ${book.title}`}
                      fill
                      className="object-contain p-4 transition-transform group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-zinc-400">
                      <BookOpen className="h-12 w-12" />
                      <span className="mt-1 text-xs">Sem capa</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClasses[book.status]}`}
                    >
                      {statusLabels[book.status]}
                    </span>
                    {book.rating ? (
                      <span className="flex items-center gap-0.5 text-xs text-yellow-500">
                        {Array.from({ length: book.rating }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-current" />
                        ))}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
                    {book.title}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {book.author}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400 dark:text-zinc-500">
                    {book.publishedDate && <span>{book.publishedDate}</span>}
                    {book.genre && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">
                        {book.genre}
                      </span>
                    )}
                  </div>
                  {book.synopsis && (
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {book.synopsis}
                    </p>
                  )}

                  <div className="mt-auto pt-3">
                    <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-mono text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {book.collection.name}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
