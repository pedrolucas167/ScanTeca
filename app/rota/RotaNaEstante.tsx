"use client";

import Link from "next/link";
import { useState } from "react";

/* Material Symbols — helper (mesmo padrão do LandingPage) */
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

/* ── Dados mock (futuramente vindos do Oráculo / API) ── */
const ROUTE_STEPS = [
  {
    id: 1,
    title: "Ficções",
    author: "J. L. Borges",
    location: "Prateleira 2 • Posição #7",
    genre: "Ficção Hispano-Americana",
    spine: "1,6 cm",
    publisher: "Ed. Cosac Naify",
    instruction:
      'Localizado no 7º livro da esquerda para a direita, exatamente acomodado entre Cortázar e Bioy Casares. Lombada preta fosca com inscrição vertical dourada.',
    coverUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuACAiU5hXpyj04kNnE_iTQ6kmUZBFsymTHS9zpRYplzjFHI787M3JYO0igrOPZogTnSb4a6X4zFo0Mrj3hO-FU3x7NH55xcvapvhK06i9bmxEok-gvpKTjzhzzwC2GDXdpF6zFwCWD7YsiTpSSuGJ2Lms-CyWx9pVDghheVGVE-neKLc9EMpbSx_VovFFFp_cIN2TfQPQ0JCKhoxc2a_ruSHLfNvZjzk4yH3DktMVR6SJgV3OgvMxxAQg",
    spineName: "Ficções",
    shelfLabel: "Prateleira 2 • Foco Ativo",
    heightLabel: "1,20m",
  },
  {
    id: 2,
    title: "O Estrangeiro",
    author: "Albert Camus",
    location: "Prateleira 2 • Posição #14",
    genre: "Filosofia",
    spine: "1,2 cm",
    publisher: "Record",
    instruction: "",
    coverUrl: "",
    spineName: "Camus",
    shelfLabel: "",
    heightLabel: "",
  },
  {
    id: 3,
    title: "A Metamorfose",
    author: "Franz Kafka",
    location: "Pilha Mesa de Cabeceira • Topo",
    genre: "Ficção Centro-Europeia",
    spine: "0,8 cm",
    publisher: "Companhia das Letras",
    instruction: "",
    coverUrl: "",
    spineName: "Kafka",
    shelfLabel: "",
    heightLabel: "",
  },
];

export default function RotaNaEstante() {
  const [collected, setCollected] = useState<Set<number>>(new Set());
  const activeIdx = ROUTE_STEPS.findIndex((s) => !collected.has(s.id));
  const activeStep = activeIdx >= 0 ? ROUTE_STEPS[activeIdx] : null;

  function markCollected(id: number) {
    setCollected((prev) => new Set(prev).add(id));
  }

  function skipToNext() {
    if (activeStep) markCollected(activeStep.id);
  }

  const collectedCount = collected.size;
  const remaining = ROUTE_STEPS.length - collectedCount;

  return (
    <div className="flex flex-1 flex-col bg-surface text-on-surface">
      {/* Mobile Container */}
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
              {ROUTE_STEPS.length} volumes
            </span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-gutter-mobile py-space-md space-y-space-lg pb-24">
          {/* 1. Context & Retrieval Summary Card */}
          <section className="rounded-2xl p-space-md bg-surface-container-low border border-outline-variant/20 relative overflow-hidden shadow-sm">
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-primary-container/15 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-space-xs mb-space-xs">
              <Icon name="auto_awesome" className="text-primary text-sm" />
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                Roteiro Sinóptico de Resgate
              </span>
            </div>
            <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight leading-snug">
              Isolamento &amp; Labirintos
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Recuperação física contextual orquestrada a partir da sua consulta vetorial no acervo pessoal.
            </p>
            {/* Route Metrics Bento Strip */}
            <div className="grid grid-cols-3 gap-space-xs mt-space-md pt-space-xs border-t border-outline-variant/20">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline">Topologia</span>
                <span className="font-body-sm text-body-sm text-on-surface font-medium">1 estante + 1 pilha</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline">Estimativa</span>
                <span className="font-body-sm text-body-sm text-on-surface font-medium">~45 seg</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline">Progresso</span>
                <span className="font-body-sm text-body-sm text-primary font-medium">
                  {activeStep ? `Passo ${activeIdx + 1} de ${ROUTE_STEPS.length}` : "Concluído!"}
                </span>
              </div>
            </div>
          </section>

          {/* 2. Visual Bookshelf Schematic */}
          <section className="rounded-2xl p-space-md bg-surface-container border border-outline-variant/20 relative shadow-lg">
            <div className="flex justify-between items-baseline mb-space-sm">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface text-lg font-medium">
                  Estante Principal
                </h2>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Sala de Leitura • Módulo A
                </span>
              </div>
              <span className="font-label-sm text-label-sm bg-surface-container-highest px-2 py-0.5 rounded text-on-surface-variant flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Em tempo real
              </span>
            </div>

            {/* Shelf Blueprint */}
            <div className="relative bg-surface-container-lowest rounded-xl p-space-sm border border-outline-variant/30 overflow-hidden">
              <div className="flex">
                {/* Ruler */}
                <div className="w-12 border-r border-outline-variant/30 flex flex-col justify-between py-2 pr-1.5 font-label-sm text-label-sm text-outline text-right select-none">
                  <span className="h-6">2,10m</span>
                  <span className="h-8">1,80m</span>
                  <span className="h-14 font-bold text-primary flex items-center justify-end gap-0.5">
                    <Icon name="visibility" className="text-xs" />
                    1,20m
                  </span>
                  <span className="h-8">0,60m</span>
                  <span className="h-5">0,00m</span>
                </div>

                {/* Shelf Elevation */}
                <div className="flex-1 pl-2.5 flex flex-col justify-between space-y-2">
                  {/* Shelf 1 (Upper - Inactive) */}
                  <div className="h-10 border-b-2 border-surface-variant flex items-end px-1 gap-1 opacity-40">
                    {[2.5, 3, 2, 4, 3, 2.5, 2, 3.5].map((w, i) => (
                      <div key={i} className="bg-surface-container-highest rounded-t-sm" style={{ width: `${w * 4}px`, height: `${(6 + i) * 4}px` }} />
                    ))}
                  </div>

                  {/* Shelf 2 (ACTIVE FOCUS TIER) */}
                  <div className="relative bg-primary-container/10 -mx-1 px-2 py-1 rounded-lg border border-primary/30">
                    <div className="absolute -top-2 left-2 px-1.5 bg-primary text-on-primary font-label-sm text-[9px] font-bold rounded-sm uppercase tracking-wider">
                      Prateleira 2 • Foco Ativo
                    </div>
                    <div className="h-20 border-b-4 border-primary-container flex items-end gap-1 pt-3 relative">
                      {/* SVG path */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 64 22 L 132 22" stroke="#c4c0ff" strokeDasharray="3,3" strokeLinecap="round" strokeWidth="2" />
                      </svg>

                      {/* Dummy books before target 1 */}
                      {[2, 3, 2, 2.5, 3, 2.5].map((w, i) => (
                        <div key={`pre-${i}`} className="bg-surface-container-high rounded-t-sm opacity-60" style={{ width: `${w * 4}px`, height: `${(12 + i) * 4}px` }} />
                      ))}

                      {/* TARGET 1: Ficções */}
                      <div className="relative group cursor-pointer flex flex-col items-center">
                        <div className="absolute -top-5 w-5 h-5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-xs font-bold flex items-center justify-center shadow-lg border border-white/30 animate-bounce">
                          1
                        </div>
                        <div className="w-4 h-16 bg-gradient-to-t from-primary-container via-inverse-primary to-primary rounded-t-sm shadow-md border-x border-primary/50 relative flex items-center justify-center">
                          <span className="[writing-mode:vertical-rl] text-[8px] text-on-primary font-caption font-bold tracking-tighter uppercase rotate-180 truncate">
                            Ficções
                          </span>
                        </div>
                      </div>

                      {/* Books between targets */}
                      {[2, 2.5, 3, 2, 3, 2.5].map((w, i) => (
                        <div key={`mid-${i}`} className="bg-surface-container-highest rounded-t-sm opacity-60" style={{ width: `${w * 4}px`, height: `${(13 + i) * 4}px` }} />
                      ))}

                      {/* TARGET 2: O Estrangeiro */}
                      <div className="relative group cursor-pointer flex flex-col items-center">
                        <div className="absolute -top-4 w-4 h-4 rounded-full bg-secondary-container text-secondary font-label-sm text-[10px] font-bold flex items-center justify-center border border-secondary/40">
                          2
                        </div>
                        <div className="w-3.5 h-15 bg-gradient-to-t from-secondary-container to-secondary rounded-t-sm shadow-sm border-x border-secondary/40 relative flex items-center justify-center">
                          <span className="[writing-mode:vertical-rl] text-[7px] text-on-secondary font-caption font-semibold tracking-tighter uppercase rotate-180 truncate">
                            Camus
                          </span>
                        </div>
                      </div>

                      {/* Remaining books */}
                      {[2, 3, 2].map((w, i) => (
                        <div key={`post-${i}`} className="bg-surface-container-high rounded-t-sm opacity-50" style={{ width: `${w * 4}px`, height: `${(12 + i) * 4}px` }} />
                      ))}
                    </div>
                  </div>

                  {/* Shelf 3 (Lower) */}
                  <div className="h-10 border-b-2 border-surface-variant flex items-end px-1 gap-1 opacity-35 relative">
                    {[3, 4, 2.5, 3, 2, 3.5].map((w, i) => (
                      <div key={i} className="bg-surface-container-high rounded-t-sm" style={{ width: `${w * 4}px`, height: `${(7 + i) * 4}px` }} />
                    ))}
                    <svg className="absolute -right-1 bottom-1 w-20 h-14 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M 0 0 C 15 10, 20 25, 25 35" fill="none" stroke="#ccbeff" strokeDasharray="2,2" strokeWidth="1.5" />
                    </svg>
                  </div>

                  {/* Extra-Module: Mesa de Cabeceira */}
                  <div className="flex items-center justify-between pt-1 text-on-surface-variant">
                    <div className="flex items-center gap-1.5 text-caption">
                      <Icon name="south_east" className="text-xs text-primary" />
                      <span className="font-body-sm text-body-sm text-outline">Transição de móvel:</span>
                      <span className="font-body-sm text-body-sm text-on-surface">Pilha da Mesa de Cabeceira</span>
                    </div>
                    <div className="flex items-center gap-1 bg-surface-container-high px-2 py-0.5 rounded-full border border-outline-variant/30">
                      <div className="w-3.5 h-3.5 rounded-full bg-surface-variant text-on-surface font-label-sm text-[9px] font-bold flex items-center justify-center">
                        3
                      </div>
                      <span className="font-label-sm text-label-sm text-outline">Kafka</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-space-sm flex items-center justify-between text-caption text-outline px-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary" /> Ponto 1 Ativo
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-secondary" /> Ponto 2 Próximo
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-surface-variant" /> Ponto 3 Pilha
              </span>
            </div>
          </section>

          {/* 3. Current Book Guidance Card */}
          {activeStep && (
            <section className="rounded-2xl p-space-md bg-surface-container-low border border-primary/30 relative shadow-xl overflow-hidden">
              <div className="absolute -left-12 -bottom-12 w-36 h-36 bg-primary-container/20 rounded-full blur-3xl pointer-events-none" />
              {/* Step Header */}
              <div className="flex items-center justify-between mb-space-sm">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-on-primary font-bold text-xs flex items-center justify-center font-label-sm">
                    {activeIdx + 1}
                  </span>
                  <span className="font-label-md text-label-md text-primary font-semibold">
                    Passo {activeIdx + 1}: {activeStep.location.split("•")[0].trim()}
                  </span>
                </div>
                <span className="font-label-sm text-label-sm text-outline bg-surface-container-high px-2 py-0.5 rounded">
                  {activeStep.heightLabel || activeStep.location}
                </span>
              </div>

              {/* Book Metadata Box */}
              <div className="flex gap-space-md items-start bg-surface-container-lowest/80 p-space-sm rounded-xl border border-outline-variant/20">
                {activeStep.coverUrl ? (
                  <div className="w-16 h-24 rounded shadow-md overflow-hidden flex-shrink-0 relative border border-outline-variant/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="w-full h-full object-cover"
                      alt={`Capa de ${activeStep.title}`}
                      src={activeStep.coverUrl}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent flex items-end p-1">
                      <span className="text-[9px] font-caption text-on-surface font-semibold leading-tight">
                        {activeStep.title}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-16 h-24 rounded shadow-md flex-shrink-0 border border-outline-variant/30 bg-surface-container-high flex items-center justify-center">
                    <Icon name="menu_book" className="text-2xl text-outline" />
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-between h-full">
                  <div>
                    <span className="font-label-sm text-label-sm text-primary uppercase tracking-wide">
                      {activeStep.genre}
                    </span>
                    <h3 className="font-headline-md text-headline-md text-xl font-semibold text-on-surface leading-tight mt-0.5">
                      {activeStep.title}
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant italic">
                      {activeStep.author}
                    </p>
                  </div>
                  <div className="mt-2 text-caption text-outline flex items-center gap-1.5">
                    <Icon name="straighten" className="text-sm text-primary" />
                    <span>Lombada {activeStep.spine} • {activeStep.publisher}</span>
                  </div>
                </div>
              </div>

              {/* Tactile Retrieval Instructions */}
              {activeStep.instruction && (
                <div className="mt-space-sm p-space-sm rounded-lg bg-surface-container/60 border border-outline-variant/20 text-on-surface">
                  <div className="flex items-start gap-2">
                    <Icon name="pan_tool" className="text-primary text-base mt-0.5 flex-shrink-0" />
                    <p className="font-body-sm text-body-sm leading-relaxed">
                      {activeStep.instruction}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-space-md flex flex-col sm:flex-row gap-space-xs">
                <button
                  onClick={() => markCollected(activeStep.id)}
                  className="flex-1 h-12 rounded-full bg-primary-container hover:bg-inverse-primary text-on-primary-container font-label-md text-label-md font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-primary-container/40 active:scale-95 transition-all"
                >
                  <Icon name="check_circle" className="text-lg" />
                  Marcar como Em Mãos
                </button>
                {activeIdx < ROUTE_STEPS.length - 1 && (
                  <button
                    onClick={skipToNext}
                    className="h-12 px-space-md rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface border border-outline-variant/30 font-label-md text-label-md flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <span>Pular para {ROUTE_STEPS[activeIdx + 1]?.author}</span>
                    <Icon name="arrow_forward" className="text-sm" />
                  </button>
                )}
              </div>
            </section>
          )}

          {/* 4. Ordered Sequence Strip */}
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
              {ROUTE_STEPS.map((step, i) => {
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
                      <div>
                        <p className="font-body-sm text-body-sm font-semibold text-on-surface">
                          {step.title} — {step.author}
                        </p>
                        <p className={`font-caption text-caption ${isActive ? "text-primary" : "text-outline"}`}>
                          {step.location}
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
                      <Icon name="chevron_right" className="text-outline text-lg" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Finish Route Banner */}
          <div className="pt-space-xs">
            <Link
              href="/oracle"
              className="w-full py-space-sm px-space-md rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface border border-outline-variant/30 flex items-center justify-center gap-2 text-label-md font-label-md active:scale-95 transition-transform shadow-sm"
            >
              <Icon name="assignment_turned_in" className="text-primary" />
              <span>Concluir Coleta &amp; Retornar ao Oráculo</span>
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
