"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";

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

interface RouteStep {
  id: string;
  step: number;
  title: string;
  author: string;
  genre: string | null;
  pages: number | null;
  spine: string;
  coverUrl: string | null;
  status: string;
  collection: string;
}

interface RouteData {
  oracle: { steps: RouteStep[]; query: string | null };
  reading: { steps: RouteStep[] };
}

const statusLabels: Record<string, string> = {
  READ: "Lido",
  READING: "Lendo",
  TO_READ: "A ler",
  WISHLIST: "Desejo",
};

export default function RotaNaEstante() {
  const [data, setData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"oracle" | "reading">("oracle");
  const [collected, setCollected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const books = new URLSearchParams(window.location.search).get("books");
    const endpoint = books ? `/api/rota?books=${encodeURIComponent(books)}` : "/api/rota";
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RouteData | null) => {
        if (d) {
          setData(d);
          if (d.oracle.steps.length === 0 && d.reading.steps.length > 0) {
            setMode("reading");
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const steps =
    mode === "oracle" ? (data?.oracle.steps ?? []) : (data?.reading.steps ?? []);

  const activeIdx = steps.findIndex((s) => !collected.has(s.id));
  const activeStep = activeIdx >= 0 ? steps[activeIdx] : null;

  const markCollected = useCallback((id: string) => {
    setCollected((prev) => new Set(prev).add(id));
  }, []);

  const skipToNext = useCallback(() => {
    if (activeStep) markCollected(activeStep.id);
  }, [activeStep, markCollected]);

  const collectedCount = collected.size;
  const remaining = steps.length - collectedCount;

  const totalSpineCm = steps.reduce((sum, s) => {
    const cm = s.pages ? Math.max(0.8, Math.round(s.pages * 0.08 * 10) / 10) : 1;
    return sum + cm;
  }, 0);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface text-on-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="font-body-sm text-body-sm text-on-surface-variant">Carregando roteiro...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-md flex-col relative min-h-screen">
        {/* TopAppBar */}
        <header className="bg-surface sticky top-16 z-40 flex items-center justify-between w-full px-gutter-mobile h-14 shadow-sm border-b border-outline-variant/20">
          <div className="flex items-center gap-space-xs">
            <Link
              href="/oracle"
              aria-label="Voltar para o Oráculo"
              className="text-primary hover:bg-surface-container-high rounded-full p-2 active:scale-95 transition-transform duration-150 flex items-center justify-center"
            >
              <Icon name="arrow_back" />
            </Link>
            <span className="font-headline-lg-mobile text-headline-lg-mobile text-primary tracking-tight">
              Rota na Estante
            </span>
          </div>
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm bg-primary-container/20 text-primary border border-primary/30 px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping inline-block" />
              {steps.length} {steps.length === 1 ? "volume" : "volumes"}
            </span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-gutter-mobile py-space-md space-y-space-lg pb-24">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-full border border-white/5 bg-surface-container-low p-1">
            <button
              onClick={() => { setMode("oracle"); setCollected(new Set()); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 px-3 font-label-md text-label-md transition-all ${
                mode === "oracle"
                  ? "bg-primary-container text-on-primary-container shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name="auto_awesome" className="text-sm" fill={mode === "oracle"} />
              <span>Oráculo</span>
              {(data?.oracle.steps.length ?? 0) > 0 && (
                <span className="font-caption text-caption text-outline">{data!.oracle.steps.length}</span>
              )}
            </button>
            <button
              onClick={() => { setMode("reading"); setCollected(new Set()); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 px-3 font-label-md text-label-md transition-all ${
                mode === "reading"
                  ? "bg-primary-container text-on-primary-container shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name="menu_book" className="text-sm" fill={mode === "reading"} />
              <span>Leitura</span>
              {(data?.reading.steps.length ?? 0) > 0 && (
                <span className="font-caption text-caption text-outline">{data!.reading.steps.length}</span>
              )}
            </button>
          </div>

          {/* Summary Card */}
          <section className="rounded-2xl p-space-md bg-surface-container-low border border-outline-variant/20 relative overflow-hidden shadow-sm">
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-primary-container/15 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-space-xs mb-space-xs">
              <Icon name={mode === "oracle" ? "auto_awesome" : "menu_book"} className="text-primary text-sm" />
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                {mode === "oracle" ? "Roteiro do Oráculo" : "Roteiro de Leitura"}
              </span>
            </div>
            {mode === "oracle" && data?.oracle.query ? (
              <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight leading-snug">
                &ldquo;{data.oracle.query}&rdquo;
              </h1>
            ) : (
              <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight leading-snug">
                {mode === "oracle" ? "Nenhuma consulta recente" : "Livros em Leitura & Na Fila"}
              </h1>
            )}
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {mode === "oracle"
                ? "Recuperação física dos livros encontrados pela busca vetorial no seu acervo."
                : "Roteiro para localizar seus livros em leitura e na fila na estante."}
            </p>
            <div className="grid grid-cols-3 gap-space-xs mt-space-md pt-space-xs border-t border-outline-variant/20">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline">Volumes</span>
                <span className="font-body-sm text-body-sm text-on-surface font-medium">{steps.length}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline">Lombada Total</span>
                <span className="font-body-sm text-body-sm text-on-surface font-medium">
                  {totalSpineCm.toFixed(1).replace(".", ",")} cm
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline">Progresso</span>
                <span className="font-body-sm text-body-sm text-primary font-medium">
                  {steps.length === 0
                    ? "Sem livros"
                    : activeStep
                      ? `Passo ${activeIdx + 1} de ${steps.length}`
                      : "Concluído!"}
                </span>
              </div>
            </div>
          </section>

          {/* Empty State */}
          {steps.length === 0 && (
            <section className="flex flex-col items-center justify-center py-16 text-center">
              <Icon name={mode === "oracle" ? "auto_awesome" : "menu_book"} className="mb-4 text-5xl text-outline/30" />
              <h2 className="text-lg font-semibold text-on-surface">
                {mode === "oracle"
                  ? "Nenhum livro retornado pelo Oráculo"
                  : "Nenhum livro em leitura ou na fila"}
              </h2>
              <p className="mt-2 max-w-xs text-sm text-on-surface-variant">
                {mode === "oracle"
                  ? "Faça uma pergunta ao Oráculo para gerar um roteiro de resgate."
                  : "Adicione livros com status \"Lendo\" ou \"A ler\" para vê-los aqui."}
              </p>
              <Link
                href={mode === "oracle" ? "/oracle" : "/scanner"}
                className="mt-6 rounded-full bg-primary-container px-6 py-2.5 font-label-md text-label-md font-semibold text-on-primary-container shadow-md transition-colors hover:bg-inverse-primary active:scale-95"
              >
                {mode === "oracle" ? "Ir para o Oráculo" : "Adicionar Livros"}
              </Link>
            </section>
          )}

          {/* Current Book Guidance Card */}
          {activeStep && (
            <section className="rounded-2xl p-space-md bg-surface-container-low border border-primary/30 relative shadow-xl overflow-hidden">
              <div className="absolute -left-12 -bottom-12 w-36 h-36 bg-primary-container/20 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between mb-space-sm">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-on-primary font-bold text-xs flex items-center justify-center font-label-sm">
                    {activeIdx + 1}
                  </span>
                  <span className="font-label-md text-label-md text-primary font-semibold">
                    Passo {activeIdx + 1}: {activeStep.collection}
                  </span>
                </div>
                <span className="font-label-sm text-label-sm text-outline bg-surface-container-high px-2 py-0.5 rounded">
                  {statusLabels[activeStep.status] ?? activeStep.status}
                </span>
              </div>

              <div className="flex gap-space-md items-start bg-surface-container-lowest/80 p-space-sm rounded-xl border border-outline-variant/20">
                {activeStep.coverUrl ? (
                  <div className="w-16 h-24 rounded shadow-md overflow-hidden flex-shrink-0 relative border border-outline-variant/30">
                    <Image
                      src={activeStep.coverUrl}
                      alt={`Capa de ${activeStep.title}`}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-24 rounded shadow-md flex-shrink-0 border border-outline-variant/30 bg-surface-container-high flex items-center justify-center">
                    <Icon name="menu_book" className="text-2xl text-outline" />
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-between h-full">
                  <div>
                    {activeStep.genre && (
                      <span className="font-label-sm text-label-sm text-primary uppercase tracking-wide">
                        {activeStep.genre}
                      </span>
                    )}
                    <h3 className="font-headline-md text-headline-md text-xl font-semibold text-on-surface leading-tight mt-0.5">
                      {activeStep.title}
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant italic">
                      {activeStep.author}
                    </p>
                  </div>
                  <div className="mt-2 text-caption text-outline flex items-center gap-1.5">
                    <Icon name="straighten" className="text-sm text-primary" />
                    <span>Lombada {activeStep.spine} • {activeStep.pages ?? "—"} págs</span>
                  </div>
                </div>
              </div>

              <div className="mt-space-md flex flex-col sm:flex-row gap-space-xs">
                <button
                  onClick={() => markCollected(activeStep.id)}
                  className="flex-1 h-12 rounded-full bg-primary-container hover:bg-inverse-primary text-on-primary-container font-label-md text-label-md font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-primary-container/40 active:scale-95 transition-all"
                >
                  <Icon name="check_circle" className="text-lg" />
                  Marcar como Em Mãos
                </button>
                {activeIdx < steps.length - 1 && (
                  <button
                    onClick={skipToNext}
                    className="h-12 px-space-md rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface border border-outline-variant/30 font-label-md text-label-md flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <span>Pular para {steps[activeIdx + 1]?.author}</span>
                    <Icon name="arrow_forward" className="text-sm" />
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Ordered Sequence Strip */}
          {steps.length > 0 && (
            <section className="space-y-space-xs">
              <div className="flex justify-between items-center px-1">
                <h4 className="font-label-md text-label-md text-on-surface font-semibold uppercase tracking-wider">
                  Sequência do Roteiro
                </h4>
                <span className="font-label-sm text-label-sm text-outline">
                  {collectedCount} coletado{collectedCount !== 1 ? "s" : ""} / {remaining} restante{remaining !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {steps.map((step, i) => {
                  const isActive = activeStep?.id === step.id;
                  const isDone = collected.has(step.id);
                  return (
                    <div
                      key={step.id}
                      className={`p-3 rounded-xl flex items-center justify-between transition-opacity ${
                        isDone
                          ? "bg-surface-container-low border border-emerald-500/30 opacity-60"
                          : isActive
                            ? "bg-surface-container border border-primary/40"
                            : "bg-surface-container-low border border-outline-variant/20 opacity-85 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {step.coverUrl ? (
                          <div className="relative h-10 w-7 flex-shrink-0 overflow-hidden rounded-sm border border-outline-variant/30">
                            <Image src={step.coverUrl} alt="" fill className="object-cover" sizes="28px" />
                          </div>
                        ) : (
                          <span
                            className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center ${
                              isDone
                                ? "bg-emerald-500/20 text-emerald-400"
                                : isActive
                                  ? "bg-primary-container text-on-primary-container"
                                  : "bg-surface-variant text-on-surface-variant font-medium"
                            }`}
                          >
                            {isDone ? <Icon name="check" className="text-sm" /> : i + 1}
                          </span>
                        )}
                        <div>
                          <p className="font-body-sm text-body-sm font-semibold text-on-surface">
                            {step.title} — {step.author}
                          </p>
                          <p className={`font-caption text-caption ${isActive ? "text-primary" : "text-outline"}`}>
                            {step.collection} • {step.spine}
                          </p>
                        </div>
                      </div>
                      {isDone ? (
                        <span className="font-label-sm text-label-sm text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Coletado
                        </span>
                      ) : isActive ? (
                        <span className="font-label-sm text-label-sm text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                          Buscando
                        </span>
                      ) : (
                        <span className="font-label-sm text-label-sm text-outline">
                          {statusLabels[step.status] ?? step.status}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Finish Route Banner */}
          <div className="pt-space-xs">
            <Link
              href={mode === "oracle" ? "/oracle" : "/"}
              className="w-full py-space-sm px-space-md rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface border border-outline-variant/30 flex items-center justify-center gap-2 text-label-md font-label-md active:scale-95 transition-transform shadow-sm"
            >
              <Icon name="assignment_turned_in" className="text-primary" />
              <span>
                {mode === "oracle"
                  ? "Concluir Coleta & Retornar ao Oráculo"
                  : "Concluir & Voltar ao Catálogo"}
              </span>
            </Link>
          </div>
        </main>

        {/* BottomNavBar */}
        <nav
          aria-label="Navegação Principal"
          className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-gutter-mobile py-space-xs bg-surface-container-low border-t border-outline-variant/20 shadow-lg md:max-w-md md:left-1/2 md:-translate-x-1/2"
        >
          <Link href="/" className="flex flex-col items-center justify-center text-on-surface-variant px-3 py-1.5 hover:bg-surface-container-highest hover:text-on-surface rounded-lg active:scale-95 transition-transform duration-150">
            <Icon name="shelves" />
            <span className="font-label-sm text-label-sm mt-0.5">Estante</span>
          </Link>
          <Link href="/rota" className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-4 py-1.5 active:scale-95 transition-transform duration-150 shadow-md">
            <Icon name="route" fill />
            <span className="font-label-sm text-label-sm mt-0.5 font-bold">Roteiro</span>
          </Link>
          <Link href="/oracle" className="flex flex-col items-center justify-center text-on-surface-variant px-3 py-1.5 hover:bg-surface-container-highest hover:text-on-surface rounded-lg active:scale-95 transition-transform duration-150">
            <Icon name="auto_awesome" />
            <span className="font-label-sm text-label-sm mt-0.5">Oráculo</span>
          </Link>
          <Link href="/" className="flex flex-col items-center justify-center text-on-surface-variant px-3 py-1.5 hover:bg-surface-container-highest hover:text-on-surface rounded-lg active:scale-95 transition-transform duration-150">
            <Icon name="menu_book" />
            <span className="font-label-sm text-label-sm mt-0.5">Catálogo</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
