"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import BookPreviewSheet from "./BookPreviewSheet";
import { useBookRegistration } from "./useBookRegistration";
import { useBookSearch } from "./useBookSearch";

function Icon({
  name,
  className = "",
  fill = false,
}: {
  name: string;
  className?: string;
  fill?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

export default function BookSearch() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const { query, results, loading, searched, changeQuery, searchNow } = useBookSearch(setMessage);
  const { addedIds, previewBook, saving, openPreview, saveBook, closePreview } = useBookRegistration(setMessage);

  return (
    <div className="flex flex-1 flex-col bg-surface px-4 pb-6 pt-2 text-on-surface">
      <p className="mb-4 font-body-sm text-body-sm text-on-surface-variant">
        Pesquise por título, autor ou ISBN e adicione com um clique. Gênero e
        páginas são preenchidos automaticamente quando disponíveis.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void searchNow();
        }}
        className="mb-4 flex gap-2"
      >
        <div className="relative flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-outline"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Ex: Dom Casmurro, Machado de Assis, 97885..."
            className="w-full rounded-full border border-outline-variant/40 bg-surface-container py-2.5 pl-10 pr-4 font-body-sm text-body-sm text-on-surface placeholder:text-outline/70 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-primary-container px-5 py-2.5 font-label-md text-label-md text-on-primary-container shadow-md transition-colors hover:bg-inverse-primary disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {message && (
        <div
          className={`mb-4 rounded-lg p-3 font-body-sm text-body-sm font-medium ${
            message.includes("adicionado")
              ? "bg-emerald-950/40 text-emerald-300"
              : "bg-error-container/20 text-error"
          }`}
        >
          {message}
        </div>
      )}

      {searched && !loading && results.length === 0 && !message && (
        <div className="flex flex-col items-center py-16 text-center">
          <Icon name="menu_book" className="mb-4 text-5xl text-outline/30" />
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Nenhum resultado. Tente outro termo ou{" "}
            <Link href="/manual-add" className="text-primary underline">
              adicione manualmente
            </Link>
            .
          </p>
        </div>
      )}

      <div className="space-y-3">
        {results.map((book) => {
          const added = addedIds.has(book.googleId);
          return (
            <div
              key={book.googleId}
              className="flex gap-4 rounded-xl border border-outline-variant/30 bg-surface-container p-4 shadow-sm"
            >
              <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md border border-outline-variant/30 bg-surface-container-high">
                {book.coverUrl ? (
                  <Image
                    src={book.coverUrl}
                    alt={`Capa de ${book.title}`}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-outline">
                    <Icon name="menu_book" className="text-3xl" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-body-sm text-body-sm font-bold text-on-surface">
                  {book.title}
                  {book.subtitle && (
                    <span className="font-normal text-on-surface-variant">
                      : {book.subtitle}
                    </span>
                  )}
                </h3>
                <p className="mt-0.5 font-caption text-caption text-on-surface-variant">
                  {book.author}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-caption text-caption text-outline">
                  {book.publishedDate && <span>{book.publishedDate}</span>}
                  {book.pages && <span>{book.pages} págs</span>}
                  {book.genre && (
                    <span className="rounded bg-surface-container-high px-1.5 py-0.5 text-[10px]">
                      {book.genre}
                    </span>
                  )}
                  {book.isbn && (
                    <span className="font-mono text-[10px]">{book.isbn}</span>
                  )}
                </div>
                {book.synopsis && (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-on-surface-variant">
                    {book.synopsis}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-start">
                <button
                  onClick={() => openPreview(book)}
                  disabled={loading || added}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-label-sm text-label-sm font-semibold transition-colors ${
                    added
                      ? "bg-emerald-950/40 text-emerald-300"
                      : "bg-primary-container text-on-primary-container hover:bg-inverse-primary disabled:cursor-not-allowed disabled:opacity-70"
                  }`}
                >
                  {added ? (
                    <>
                      <Icon name="check" className="text-sm" />
                      Adicionado
                    </>
                  ) : (
                    <>
                      <Icon name="add" className="text-sm" />
                      Adicionar
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {results.length > 0 && (
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push("/")}
            className="font-body-sm text-body-sm font-medium text-primary hover:text-primary-fixed-dim"
          >
            Ir para o catálogo →
          </button>
        </div>
      )}

      {previewBook && (
        <BookPreviewSheet
          book={previewBook}
          loading={saving}
          onConfirm={saveBook}
          onCancel={closePreview}
        />
      )}
    </div>
  );
}
