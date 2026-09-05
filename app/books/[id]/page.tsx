import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { BookReviews } from "./BookReviews";

export const dynamic = "force-dynamic";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;

  const book = await prisma.book.findFirst({
    where: { id, userId },
    include: {
      reviews: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!book) {
    notFound();
  }

  const statusLabels: Record<string, string> = {
    READ: "Lido",
    TO_READ: "A ler",
    WISHLIST: "Desejo",
  };

  const statusClasses: Record<string, string> = {
    READ: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    TO_READ: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    WISHLIST:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  };

  const avgRating =
    book.reviews.length > 0
      ? (
          book.reviews.reduce((acc, r) => acc + (r.rating || 0), 0) /
          book.reviews.length
        ).toFixed(1)
      : null;

  return (
    <div className="flex flex-1 flex-col px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          ← Voltar ao catálogo
        </Link>

        <div className="mb-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col md:flex-row">
            <div className="relative flex h-64 w-full items-center justify-center bg-zinc-100 dark:bg-zinc-800 md:h-auto md:w-56 md:shrink-0">
              {book.coverUrl ? (
                <Image
                  src={book.coverUrl}
                  alt={`Capa de ${book.title}`}
                  fill
                  className="object-contain p-6"
                  sizes="(max-width: 768px) 100vw, 224px"
                />
              ) : (
                <div className="flex flex-col items-center text-zinc-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                  <span className="mt-2 text-sm">Sem capa</span>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses[book.status]}`}
                >
                  {statusLabels[book.status]}
                </span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-mono text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {book.collection}
                </span>
              </div>

              <h1 className="text-2xl font-bold leading-tight text-foreground">
                {book.title}
              </h1>
              <p className="mt-1 text-base text-zinc-600 dark:text-zinc-400">
                {book.author}
              </p>

              {book.publishedDate && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                  {book.publishedDate}
                </p>
              )}

              {book.rating ? (
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-yellow-500">{"★".repeat(book.rating)}</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    Sua avaliação
                  </span>
                </div>
              ) : null}

              {avgRating && (
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Média das reviews: {" "}
                  <span className="font-medium text-yellow-500">
                    {"★".repeat(Math.round(Number(avgRating)))}
                  </span>{" "}
                  ({avgRating}) · {book.reviews.length} review
                  {book.reviews.length === 1 ? "" : "s"}
                </div>
              )}

              {book.synopsis && (
                <div className="mt-4">
                  <h2 className="text-sm font-semibold text-foreground">
                    Sinopse
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {book.synopsis}
                  </p>
                </div>
              )}

              {book.notes && (
                <div className="mt-4">
                  <h2 className="text-sm font-semibold text-foreground">
                    Suas notas
                  </h2>
                  <p className="mt-1 text-sm italic leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {book.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <BookReviews bookId={book.id} initialReviews={book.reviews} />
      </div>
    </div>
  );
}
