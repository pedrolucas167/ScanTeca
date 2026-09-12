"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import {
  type BookForClient as Book,
  type RecommendationsPayload,
} from "@/lib/recommendations";

function Icon({
  name,
  className = "",
  fill = false,
  style,
}: {
  name: string;
  className?: string;
  fill?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={fill ? { ...style, fontVariationSettings: "'FILL' 1" } : style}
    >
      {name}
    </span>
  );
}

const affinityClasses = {
  primary: {
    dot: "bg-primary",
    text: "text-primary",
    border: "border-primary/30",
  },
  tertiary: {
    dot: "bg-tertiary",
    text: "text-tertiary",
    border: "border-primary/30",
  },
  secondary: {
    dot: "bg-secondary",
    text: "text-secondary",
    border: "border-primary/30",
  },
  outline: {
    dot: "bg-outline",
    text: "text-on-surface-variant",
    border: "border-outline-variant/40",
  },
};

export default function DescobrirClient({
  books,
  recommendations,
}: {
  books: Book[];
  recommendations: RecommendationsPayload | null;
}) {
  const profile = recommendations?.profile ?? {
    affinity: [],
    feedbackCount: 0,
    recommendationFeedbackCount: 0,
    calibration: 0,
  };
  const primary = recommendations?.primary ?? null;
  const queue = recommendations?.queue ?? [];
  const topAffinity = profile.affinity[0]?.label ?? "seus temas";
  const [primaryFeedback, setPrimaryFeedback] = useState<
    null | "WANT" | "DISMISSED"
  >(null);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const savePrimaryFeedback = async (kind: "WANT" | "DISMISSED") => {
    if (!primary || savingFeedback) return;
    setFeedbackError(null);
    const previous = primaryFeedback;
    setPrimaryFeedback(kind);
    setSavingFeedback(true);
    try {
      const res = await fetch("/api/recommendations/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: primary.title,
          author: primary.author,
          kind,
          source: "primary",
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar feedback");
    } catch (err) {
      setPrimaryFeedback(previous);
      setFeedbackError(
        err instanceof Error ? err.message : "Erro ao salvar feedback"
      );
    } finally {
      setSavingFeedback(false);
    }
  };

  const undoPrimaryFeedback = async () => {
    if (!primary || savingFeedback) return;
    setFeedbackError(null);
    const previous = primaryFeedback;
    setPrimaryFeedback(null);
    setSavingFeedback(true);
    try {
      const res = await fetch(
        `/api/recommendations/feedback?title=${encodeURIComponent(
          primary.title
        )}&author=${encodeURIComponent(primary.author)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Erro ao desfazer feedback");
    } catch (err) {
      setPrimaryFeedback(previous);
      setFeedbackError(
        err instanceof Error ? err.message : "Erro ao desfazer feedback"
      );
    } finally {
      setSavingFeedback(false);
    }
  };

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-2xl bg-surface px-4 py-6 pb-28 text-on-surface">
      {/* Header */}
      <section className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="auto_awesome" className="text-2xl text-primary" />
          <div className="flex flex-col">
            <h1 className="font-headline-md text-headline-md font-medium leading-none tracking-tight text-on-surface">
              Descobrir
            </h1>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary-container/25 px-2 py-0.5 text-[10px] font-label-sm tracking-wide text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                Grafo Pessoal RAG
              </span>
              <span className="font-label-sm text-[11px] font-normal text-on-surface-variant">
                Afinidade: {profile.calibration}% calibrada
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Sintonizar preferências"
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high active:scale-95"
        >
          <Icon name="tune" />
        </button>
      </section>

      {/* Status */}
      <div className="mb-6 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Icon
            name="psychology"
            className="text-lg text-primary"
            fill
          />
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
            Inferência Semântica do Acervo
          </span>
        </div>
        <span className="rounded-full border border-outline-variant/30 bg-surface-container-high px-2 py-0.5 text-[11px] font-label-sm text-tertiary-fixed-dim">
          Lote #204
        </span>
      </div>

      {/* Primary recommendation */}
      {!primary ? (
        <section className="relative overflow-hidden rounded-[2rem] border border-outline-variant/30 bg-surface-container-low p-8 text-center shadow-2xl">
          <Icon
            name="auto_awesome_mosaic"
            className="mx-auto mb-3 text-4xl text-outline"
          />
          <h2 className="font-headline-md text-headline-md font-medium text-on-surface">
            Ainda não temos recomendações
          </h2>
          <p className="mt-2 text-body-sm text-on-surface-variant">
            Adicione mais livros ao acervo para ativar o grafo de afinidade e
            gerar sugestões.
          </p>
          <Link
            href="/search-add"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-bright"
          >
            <Icon name="add" className="text-sm" />
            Adicionar livro
          </Link>
        </section>
      ) : primaryFeedback === "DISMISSED" ? (
        <section className="relative overflow-hidden rounded-[2rem] border border-outline-variant/30 bg-surface-container-low p-8 text-center shadow-2xl">
          <Icon
            name="hide_source"
            className="mx-auto mb-3 text-4xl text-outline"
          />
          <h2 className="font-headline-md text-headline-md font-medium text-on-surface">
            Sugestão removida
          </h2>
          <p className="mt-2 text-body-sm text-on-surface-variant">
            Você marcou que não tem interesse. O grafo será recalibrado.
          </p>
          <button
            type="button"
            onClick={() => void undoPrimaryFeedback()}
            disabled={savingFeedback}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-bright disabled:opacity-50"
          >
            <Icon name="refresh" className="text-sm" />
            Desfazer
          </button>
        </section>
      ) : (
        <section className="relative overflow-hidden rounded-[2rem] border border-outline-variant/30 bg-surface-container-low shadow-2xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-container/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-60 w-60 rounded-full bg-tertiary-container/15 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-4 p-6">
            <div className="flex items-start gap-4">
              <div className="book-spine-relief relative aspect-[2/3] w-32 flex-shrink-0 overflow-hidden rounded-2xl border border-outline-variant/50 bg-surface-container-lowest">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-3 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 left-2.5 z-20 w-px bg-white/10" />
                <Image
                  src={primary.cover}
                  alt={primary.title}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 128px, 128px"
                  className="object-cover object-center"
                />
                <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-white/5" />
                <div className="absolute bottom-2 left-3 right-2 z-20">
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-primary opacity-90">
                    {primary.author}
                  </span>
                  <span className="line-clamp-1 text-[11px] font-semibold leading-tight text-on-surface">
                    {primary.title}
                  </span>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="rounded-full border border-secondary/20 bg-secondary-container/40 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-on-secondary-container">
                      {primary.compat}% compatível
                    </span>
                    <span className="font-label-sm text-[10px] text-tertiary">
                      Top Afinidade
                    </span>
                  </div>
                  <h2 className="font-headline-lg-mobile text-headline-lg-mobile font-medium leading-tight tracking-tight text-on-surface">
                    {primary.title}
                  </h2>
                  <p className="font-headline-md mt-0.5 text-body-md font-normal italic text-on-surface-variant">
                    {primary.author}
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-1 border-t border-outline-variant/30 pt-3 text-[12px] text-on-surface-variant">
                  <div className="flex items-center gap-1.5">
                    <Icon name="menu_book" className="text-[15px] text-primary" />
                    <span>
                      {primary.edition} • {primary.pages} págs
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon name="straighten" className="text-[15px] text-primary" />
                    <span>Lombada: ~{primary.spine} cm estimada</span>
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    Nota Predita:
                  </span>
                  <span className="font-headline-md text-[20px] font-bold tracking-tight text-primary">
                    {primary.predictedRating}
                  </span>
                  <span className="text-[12px] text-outline">/ 5.0</span>
                  <Icon
                    name="star"
                    className="ml-1 text-xs text-[#c8a968]"
                    fill
                  />
                </div>
              </div>
            </div>

            <div className="relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-primary/30 bg-surface-container/70 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[13px] font-label-md text-primary">
                <Icon name="hub" className="text-lg" fill />
                <span className="font-semibold">
                  Conexão com{" "}
                  <em className="not-italic text-on-surface">{topAffinity}</em>
                </span>
              </div>
              <p className="font-quote-md border-l-2 border-primary/60 pl-3 text-body-sm italic leading-relaxed text-on-surface/90">
                “{primary.ragQuote}”
              </p>
              <div className="flex items-center justify-between pt-1 text-[11px] text-on-surface-variant/80">
                <span className="flex items-center gap-1">
                  <Icon
                    name="fingerprint"
                    className="text-[13px] text-secondary"
                  />
                  Similaridade cosseno: {primary.similarity}
                </span>
                <span className="text-tertiary-fixed-dim">
                  Vetor #{primary.vectorId}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Link
                href={`/search-add?q=${encodeURIComponent(primary.title)}`}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-4 font-label-md text-label-md text-on-primary-container shadow-md transition-all duration-200 hover:bg-[#6366f1] active:scale-95"
              >
                <Icon name="shelves" className="text-[20px]" />
                <span>+ Adicionar à estante</span>
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void savePrimaryFeedback("WANT")}
                  disabled={savingFeedback}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-high text-[12px] font-label-sm text-on-surface transition-colors hover:bg-surface-bright active:scale-95 disabled:opacity-50"
                >
                  <Icon
                    name="bookmark"
                    className="text-[16px] text-secondary"
                  />
                  Quero ler
                </button>
                <button
                  type="button"
                  onClick={() => void savePrimaryFeedback("DISMISSED")}
                  disabled={savingFeedback}
                  className="group flex h-10 items-center justify-center gap-1 rounded-full border border-outline-variant/25 bg-surface-container/50 text-[12px] font-label-sm text-on-surface-variant transition-colors hover:border-error/40 hover:bg-surface-container-high hover:text-error active:scale-95 disabled:opacity-50"
                >
                  <Icon
                    name="close"
                    className="text-[16px] group-hover:text-error"
                  />
                  Não me interessa
                </button>
              </div>
              {primaryFeedback === "WANT" && (
                <div className="flex items-center justify-center gap-1.5 rounded-full bg-primary-container/20 py-2 text-[11px] text-primary">
                  <Icon name="check" className="text-[14px]" />
                  Você curtiu essa recomendação
                  <button
                    type="button"
                    onClick={() => void undoPrimaryFeedback()}
                    disabled={savingFeedback}
                    className="ml-1 text-on-surface-variant underline disabled:opacity-50"
                  >
                    Desfazer
                  </button>
                </div>
              )}
              {feedbackError && (
                <div className="text-center text-[11px] text-error">
                  {feedbackError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-1 text-center text-[11px] text-outline">
              <Icon
                name="sync"
                className="text-[13px] text-primary animate-spin"
                style={{ animationDuration: "6s" }}
              />
              <span>
                Cada feedback treina seu perfil e recalcula afinidades em tempo
                real.
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Affinity radar */}
      <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container/60 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="radar" className="text-xl text-primary" />
            <h3 className="font-headline-md text-[18px] font-medium text-on-surface">
              Radar de Afinidade Pessoal
            </h3>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary-container/20 px-2 py-0.5 text-[11px] font-label-sm text-secondary">
            Ativo
          </span>
        </div>
        <p className="font-body-sm text-[13px] text-on-surface-variant">
          Vetores temáticos ativos extraídos dos seus volumes lidos, anotações
          de margem e buscas semânticas:
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {profile.affinity.map((node) => (
            <span
              key={node.label}
              className={`inline-flex items-center gap-1.5 rounded-full border bg-surface-container-high px-3 py-1.5 text-[12px] font-label-sm ${affinityClasses[node.color].border} ${affinityClasses[node.color].text}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${affinityClasses[node.color].dot}`}
              />
              {node.label}
              <span className={`font-bold ${affinityClasses[node.color].text}`}>
                {Math.round(node.score * 100)}%
              </span>
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-1.5 border-t border-outline-variant/20 pt-2">
          <div className="flex justify-between text-[11px] font-label-sm">
            <span className="text-on-surface-variant">
              {books.length} livros catalogados
            </span>
            <span className="font-medium text-primary">Calibragem contínua</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-lowest">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-container via-primary to-secondary"
              style={{ width: `${profile.calibration}%` }}
            />
          </div>
        </div>
      </section>

      {/* Queue */}
      <section className="mb-4 mt-6 flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-headline-md text-[20px] font-medium text-on-surface">
            Próximas na Fila do Grafo
          </h3>
          <span className="cursor-pointer text-[12px] font-label-sm text-primary hover:underline">
            Ver todas ({queue.length})
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          {queue.map((rec) => (
            <article
              key={rec.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container p-3 transition-colors hover:border-primary/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="book-spine-relief relative h-16 w-12 flex-shrink-0 overflow-hidden rounded border border-outline-variant/40 bg-surface-container-lowest">
                  {rec.cover ? (
                    <Image
                      src={rec.cover}
                      alt={rec.title}
                      fill
                      unoptimized
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-on-surface-variant">
                      <Icon name="menu_book" className="text-[18px]" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-[15px] font-semibold text-on-surface">
                    {rec.title}
                  </h4>
                  <p className="truncate text-[12px] italic text-on-surface-variant">
                    {rec.author}
                  </p>
                  <p className="line-clamp-1 mt-0.5 text-[11px] text-tertiary-fixed-dim">
                    &ldquo;{rec.quote}&rdquo;
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <span className="text-[13px] font-bold text-primary">
                  ★ {rec.rating}
                </span>
                <Link
                  href={`/search-add?q=${encodeURIComponent(rec.title)}`}
                  aria-label={`Adicionar ${rec.title}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-colors hover:bg-primary-container hover:text-white"
                >
                  <Icon name="add" className="text-[18px]" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="mt-6 rounded-2xl border border-outline-variant/30 bg-surface-container p-4">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-on-surface">
              Quer refinar as sugestões?
            </h3>
            <p className="text-[13px] text-on-surface-variant">
              Quanto mais livros você avalia e registra no Diário, melhor fica
              o perfil.
            </p>
          </div>
          <Link
            href="/diario"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary"
          >
            Ir para o Diário
            <Icon name="arrow_forward" className="text-sm" />
          </Link>
        </div>
      </div>
    </main>
  );
}
