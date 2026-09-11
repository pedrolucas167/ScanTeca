"use client";

import { useState } from "react";
import Image from "next/image";

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

const statusMap: Record<string, string> = {
  "Na Fila": "TO_READ",
  Lendo: "READING",
  Lido: "READ",
  Consulta: "WISHLIST",
};

export interface BookDraft {
  id?: string;
  isbn?: string | null;
  title: string;
  author: string;
  publishedDate?: string | null;
  coverUrl?: string | null;
  genre?: string | null;
  pages?: number | null;
  synopsis?: string | null;
  collection?: string;
}

interface BookPreviewSheetProps {
  book: BookDraft;
  existing?: boolean;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: (status: string) => void;
  onCancel: () => void;
  onViewDetails?: () => void;
}

export default function BookPreviewSheet({
  book,
  existing = false,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
  onViewDetails,
}: BookPreviewSheetProps) {
  const [status, setStatus] = useState("Na Fila");

  const hasMissingData =
    !book.coverUrl || !book.synopsis || !book.genre || !book.pages;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60">
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-xl border-t border-outline-variant/30 bg-surface-container-high p-4 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant/50" />

        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1 font-label-sm text-label-sm text-emerald-300">
            <Icon
              name={existing ? "warning" : "check_circle"}
              className="text-[14px] text-emerald-400"
              fill
            />
            <span>
              {existing
                ? "Livro já cadastrado"
                : "ISBN Reconhecido • Pronto para adicionar"}
            </span>
          </div>
          {book.id && (
            <span className="font-caption text-caption text-outline tracking-wider">
              #{book.id.slice(0, 8)}
            </span>
          )}
        </div>

        <div className="mb-4 flex items-start gap-4 rounded-lg border border-outline-variant/25 bg-surface-container-lowest/60 p-3">
          <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-md border border-outline-variant/30 bg-surface-container-high">
            {book.coverUrl ? (
              <Image
                src={book.coverUrl}
                alt={`Capa de ${book.title}`}
                fill
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-outline">
                <Icon name="menu_book" className="text-3xl" />
              </div>
            )}
          </div>
          <div className="flex h-36 min-w-0 flex-1 flex-col justify-between">
            <div>
              <span className="block font-label-sm text-label-sm uppercase tracking-widest text-secondary">
                {book.genre || "Gênero não identificado"}
              </span>
              <h1 className="font-quote-md text-quote-md font-semibold leading-snug tracking-tight text-on-surface">
                {book.title}
              </h1>
              <p className="font-body-sm text-body-sm font-medium text-on-surface-variant">
                {book.author}
              </p>
              <p className="truncate font-caption text-caption text-outline">
                {book.publishedDate || "Ed. não informada"}
              </p>
            </div>
            <div className="flex items-center gap-2 border-t border-outline-variant/20 pt-1 font-caption text-caption text-on-surface-variant/80">
              <span className="flex items-center gap-0.5">
                <Icon name="menu_book" className="text-[13px] text-secondary" />
                {book.pages || "—"} págs
              </span>
              {book.isbn && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[10px]">{book.isbn}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {hasMissingData && !existing && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-container/20 p-2.5 text-sm text-on-surface-variant">
            <Icon name="info" className="mt-0.5 text-warning" />
            <span className="font-body-sm text-body-sm">
              Alguns dados (capa, sinopse, gênero ou páginas) ainda não foram
              encontrados. Você pode adicionar assim mesmo e completar depois na
              ficha do livro.
            </span>
          </div>
        )}

        {book.synopsis && (
          <div className="mb-4 rounded-lg border border-outline-variant/25 bg-surface-container-lowest/40 p-3">
            <h3 className="mb-1 font-label-sm text-label-sm uppercase tracking-wider text-secondary">
              Sinopse
            </h3>
            <p className="line-clamp-4 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
              {book.synopsis}
            </p>
          </div>
        )}

        {!existing && (
          <div className="mb-4 flex flex-col gap-1.5">
            <label className="font-caption text-caption text-on-surface-variant">
              Estado de Leitura
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {["Na Fila", "Lendo", "Lido", "Consulta"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex items-center gap-1 rounded-full border px-3 py-1 font-label-sm text-label-sm transition-colors ${
                    status === s
                      ? "border-primary bg-primary-container text-on-primary-container shadow-[0_0_12px_rgba(91,80,230,0.35)]"
                      : "border-outline-variant/30 bg-surface-container text-on-surface-variant hover:border-outline-variant"
                  }`}
                >
                  {status === s && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  )}
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={() => onConfirm(statusMap[status])}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-6 py-3.5 font-label-md text-label-md text-on-primary-container shadow-[0_12px_32px_-8px_rgba(91,80,230,0.4)] transition-all hover:bg-inverse-primary active:scale-[0.98] disabled:opacity-70"
          >
            <Icon name={existing ? "open_in_new" : "add_circle"} className="text-[20px]" />
            <span>
              {loading
                ? "Salvando..."
                : confirmLabel || (existing ? "Ver no catálogo" : "Adicionar ao catálogo")}
            </span>
          </button>

          {onViewDetails && book.id && !existing && (
            <button
              onClick={onViewDetails}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container px-6 py-2.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-bright active:scale-[0.98]"
            >
              <Icon name="psychology" className="text-[18px] text-tertiary" />
              <span>Ver Ficha Completa & Oráculo</span>
            </button>
          )}

          <button
            onClick={onCancel}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-low px-6 py-2.5 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-bright active:scale-[0.98]"
          >
            <Icon name="close" className="text-[18px]" />
            <span>{existing ? "Fechar" : "Cancelar"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
