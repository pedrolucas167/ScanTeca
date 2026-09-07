"use client";

import Link from "next/link";
import { useState } from "react";

/* Material Symbols — helper pra ligaduras do icon font do design Stitch */
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

const QUOTES = [
  {
    tab: "Sartre",
    content:
      "Comecei minha vida como hei de acabá-la, sem dúvida: no meio dos livros. [...] Mas os livros foram meus passarinhos e meus ninhos, meus animais domésticos, meu estábulo e minha biblioteca; a biblioteca, num recanto, realizava o mundo em espessura e em fito, o feitiço enciclopédico.",
    author: "Jean-Paul Sartre",
    work: "As Palavras",
  },
  {
    tab: "Borges",
    content:
      "Sempre imaginei que o Paraíso fosse uma espécie de livraria ou biblioteca; um labirinto ordenado onde cada espelho reflete uma página ainda não lida pelo homem.",
    author: "Jorge Luis Borges",
    work: "Ficções",
  },
  {
    tab: "Calvino",
    content:
      "Um clássico é um livro que nunca terminou de dizer aquilo que tinha para dizer. Cada releitura de um clássico é uma viagem de descoberta como a primeira.",
    author: "Italo Calvino",
    work: "Por que ler os clássicos",
  },
];

const SHELF = [
  { img: "/landing/cem-anos.jpg", title: "Cem Anos de Solidão", author: "G. García Márquez", status: "Lido", tag: "text-primary" },
  { img: "/landing/o-estrangeiro.jpg", title: "O Estrangeiro", author: "Albert Camus", status: "Lendo", tag: "text-secondary" },
  { img: "/landing/cidades-invisiveis.jpg", title: "As Cidades Invisíveis", author: "Italo Calvino", status: "Na Fila", tag: "text-outline" },
  { img: "/landing/metamorfose.jpg", title: "A Metamorfose", author: "Franz Kafka", status: "Emprestado", tag: "text-tertiary" },
  { img: "/landing/grande-sertao.jpg", title: "Grande Sertão: Veredas", author: "Guimarães Rosa", status: "Lido", tag: "text-primary" },
  { img: "/landing/ensaio-cegueira.jpg", title: "Ensaio sobre a Cegueira", author: "José Saramago", status: "Lido", tag: "text-primary" },
];

const TESTIMONIALS = [
  {
    initials: "EC",
    name: "Eduardo Castello",
    role: "Professor de Literatura & Colecionador",
    text: "Eu passei 10 anos adiando catalogar meus 1.200 livros porque achava que perderia meses no Excel. No Scanteca, passei o código de barras de 100 livros em uma única tarde de café.",
    bg: "bg-primary-container/30 text-primary",
  },
  {
    initials: "MS",
    name: "Marina Siqueira",
    role: "Arquiteta e Ensaísta",
    text: "O Oráculo IA é genial. Ontem perguntei qual livro do meu quarto falava sobre arquitetura medieval e ele me lembrou de um volume esquecido que ganhei há 5 anos.",
    bg: "bg-tertiary-container/30 text-tertiary",
  },
  {
    initials: "RL",
    name: "Rodrigo Lins",
    role: "Curador do Clube do Livro Noturno",
    text: "A métrica da 'altura da pilha de livros em metros' parece boba, mas ver que minha estante tem quase 5 metros me deu um orgulho absurdo da minha trajetória leitora.",
    bg: "bg-secondary-container/30 text-secondary",
  },
];

export default function LandingPage() {
  const [quoteIdx, setQuoteIdx] = useState(0);
  const quote = QUOTES[quoteIdx];

  return (
    <div className="flex flex-1 flex-col bg-surface text-on-surface">
      {/* 1. Hero */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-16 md:px-12 md:pt-20">
        <div className="pointer-events-none absolute left-1/2 top-10 h-[320px] w-[540px] -translate-x-1/2 rounded-full bg-primary-container/15 blur-[120px]" />
        <div className="relative mx-auto mb-14 flex max-w-4xl flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary-container/10 px-4 py-1.5 font-label-sm text-label-sm text-tertiary shadow-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span>BIBLIOTHECA PERSONALIS — O FUTURO DO LIVRO FÍSICO</span>
          </div>
          <h1 className="mb-6 font-display text-display-mobile tracking-tight text-on-surface md:text-display">
            Sua estante de livros físicos,
            <br className="hidden sm:inline" /> finalmente{" "}
            <span className="italic text-primary">viva</span> e conversacional.
          </h1>
          <p className="mb-8 max-w-2xl font-body-lg text-body-lg leading-relaxed text-on-surface-variant">
            Chega de planilhas engessadas e digitação exaustiva. Aponte a câmera
            para o código de barras, descubra a real estatura do seu acervo e
            dialogue com seus livros usando inteligência artificial semântica.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="flex items-center gap-2.5 rounded-full bg-primary-container px-7 py-3.5 font-label-md text-label-md text-white shadow-lg shadow-primary-container/35 transition-all hover:bg-inverse-primary active:scale-[0.98]"
            >
              <Icon name="menu_book" className="text-lg" fill />
              <span>Começar Minha Estante Grátis</span>
            </Link>
            <Link
              href="/manifesto"
              className="flex items-center gap-2 rounded-full border border-outline-variant/50 bg-surface-container px-7 py-3.5 font-label-md text-label-md text-on-surface transition-all hover:bg-surface-container-high active:scale-[0.98]"
            >
              <Icon name="play_circle" className="text-lg text-secondary" />
              <span>Explorar Demonstração Interativa</span>
            </Link>
          </div>
        </div>

        {/* Hero grid: citações + scan widget */}
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          {/* Quote card com abas */}
          <div className="glass-panel relative flex flex-col justify-between overflow-hidden rounded-lg border border-outline-variant/30 p-6 sm:p-8 lg:col-span-7">
            <div className="mb-6 flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <div className="flex items-center gap-2">
                <Icon name="format_quote" className="text-2xl text-primary" />
                <span className="font-caption text-caption uppercase tracking-wider text-outline">
                  Vozes Literárias
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-outline-variant/20 bg-surface-container-lowest/70 p-1">
                {QUOTES.map((q, i) => (
                  <button
                    key={q.tab}
                    onClick={() => setQuoteIdx(i)}
                    className={`rounded-full px-3 py-1 font-caption text-caption transition-all ${
                      i === quoteIdx
                        ? "active-quote-tab"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {q.tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex min-h-[160px] flex-col justify-center">
              <blockquote className="mb-5 font-quote-lg text-quote-md italic leading-relaxed text-on-surface sm:text-quote-lg">
                &ldquo;{quote.content}&rdquo;
              </blockquote>
              <p className="font-body-sm text-body-sm text-outline-variant">
                — {quote.author},{" "}
                <span className="italic text-tertiary">{quote.work}</span>
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 pt-4 font-caption text-caption text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <Icon name="verified" className="text-sm text-primary" />
                Acervo de Clássicos Francófonos Catalogados
              </span>
              <span className="text-outline">
                Localização: Prateleira Central • Volume 12
              </span>
            </div>
          </div>

          {/* Scan widget */}
          <div className="relative flex flex-col justify-between rounded-lg border border-outline-variant/30 bg-surface-container p-6 sm:p-8 lg:col-span-5">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="font-label-sm text-label-sm text-on-surface">
                    Scan em Tempo Real
                  </span>
                </div>
                <span className="rounded-full border border-outline-variant/30 bg-surface-container-high px-2.5 py-1 font-caption text-caption text-primary">
                  EAN-13 Validado
                </span>
              </div>
              <div className="mb-4 flex gap-4 rounded-lg border border-outline-variant/30 bg-surface-container-lowest/80 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="h-28 w-20 flex-shrink-0 rounded border border-outline-variant/40 object-cover shadow-md"
                  alt="Capa de As Palavras"
                  src="/landing/as-palavras.jpg"
                />
                <div className="flex flex-col justify-between overflow-hidden">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Filosofia / Memórias
                    </span>
                    <h4 className="truncate font-body-md text-body-md font-semibold text-on-surface">
                      As Palavras
                    </h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Jean-Paul Sartre
                    </p>
                  </div>
                  <div className="flex items-center gap-3 font-caption text-caption text-outline">
                    <span>216 págs</span>
                    <span>•</span>
                    <span>Nova Fronteira</span>
                    <span>•</span>
                    <span>1964</span>
                  </div>
                </div>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-2 font-caption text-caption">
                <div className="flex flex-col rounded-md border border-outline-variant/20 bg-surface-container-low p-2.5">
                  <span className="text-outline">ISBN-13</span>
                  <span className="font-mono font-medium text-on-surface">
                    978-8520932018
                  </span>
                </div>
                <div className="flex flex-col rounded-md border border-outline-variant/20 bg-surface-container-low p-2.5">
                  <span className="text-outline">Espessura Fís.</span>
                  <span className="font-mono font-medium text-on-surface">
                    1,4 cm (Estante A2)
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between font-caption text-caption text-primary">
              <span className="flex items-center gap-1">
                <Icon name="psychology" className="text-sm" />
                Vetorizado no Oráculo IA
              </span>
              <span className="font-semibold">Sinopse Extraída (100%)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Problema vs Solução */}
      <section
        className="border-y border-outline-variant/20 bg-surface-container-lowest py-20"
        id="manifesto"
      >
        <div className="mx-auto max-w-6xl px-6 md:px-12">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary">
              A Transição Bibliográfica
            </span>
            <h2 className="mb-4 mt-2 font-headline-lg text-headline-lg-mobile text-on-surface md:text-headline-lg">
              O fardo analógico vs. A precisão do Scanteca
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Amamos o cheiro do papel e o toque da capa dura. O que detestamos é
              a burocracia de manter nosso acervo ordenado.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="flex flex-col justify-between rounded-lg border border-error/20 bg-surface-container-low p-8">
              <div>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-error/30 bg-error-container/20 text-error">
                  <Icon name="table_rows_narrow" className="text-2xl" />
                </div>
                <h3 className="mb-3 font-headline-md text-headline-md text-on-surface">
                  O Fardo do Acervo Inerte
                </h3>
                <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
                  Planilhas confusas esquecidas no Google Drive, digitação
                  maçante de título por título e compras acidentais de exemplares
                  repetidos na livraria.
                </p>
                <ul className="space-y-3.5">
                  {[
                    ["Digitação Lenta:", "3 a 5 minutos gastados inserindo autor, editora, ano e sinopse por volume."],
                    ["Amnésia de Empréstimos:", "Livros emprestados a amigos que desaparecem no esquecimento."],
                    ["Zero Interatividade:", "Milhares de páginas empilhadas incapazes de responder às suas dúvidas."],
                  ].map(([t, d]) => (
                    <li
                      key={t}
                      className="flex items-start gap-3 font-body-sm text-body-sm text-on-surface-variant"
                    >
                      <Icon name="close" className="text-lg text-error" />
                      <span>
                        <strong>{t}</strong> {d}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 flex items-center gap-2 border-t border-outline-variant/20 pt-6 font-caption text-caption text-outline">
                <Icon name="sentiment_dissatisfied" className="text-sm" />
                <span>
                  84% dos colecionadores desistem de catalogar após o 50º livro.
                </span>
              </div>
            </div>

            <div className="relative flex flex-col justify-between overflow-hidden rounded-lg border border-primary/30 bg-surface-container p-8 shadow-lg shadow-primary/5">
              <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary-container/10 blur-2xl" />
              <div className="relative">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/40 bg-primary-container/20 text-primary">
                  <Icon name="auto_awesome" className="text-2xl" />
                </div>
                <h3 className="mb-3 font-headline-md text-headline-md text-on-surface">
                  O Padrão Scanteca
                </h3>
                <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
                  A tecnologia RAG e leitura de código de barras a serviço da sua
                  sensibilidade literária. Um segundo por livro, precisão perene.
                </p>
                <ul className="space-y-3.5">
                  {[
                    ["Catalogação Instantânea:", "Aponte a câmera e o ISBN puxa capa em alta definição, autor, paginação e sinopse em 2s."],
                    ["Mapeamento Físico:", "Saiba em qual estante, prateleira ou caixa cada título descansa."],
                    ["Oráculo Cognitivo (IA):", "Faça perguntas conceituais e cruze autores da sua própria coleção."],
                  ].map(([t, d]) => (
                    <li
                      key={t}
                      className="flex items-start gap-3 font-body-sm text-body-sm text-on-surface"
                    >
                      <Icon
                        name="check_circle"
                        className="text-lg text-primary"
                      />
                      <span>
                        <strong>{t}</strong> {d}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative mt-8 flex items-center gap-2 border-t border-outline-variant/20 pt-6 font-caption text-caption text-primary">
                <Icon name="bolt" className="text-sm" />
                <span>
                  Catalogação 15x mais rápida que qualquer método tradicional.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Pilares — bento grid */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24 md:px-12" id="pilares">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary">
            Engenharia Bibliófila
          </span>
          <h2 className="mb-4 mt-2 font-headline-lg text-headline-lg-mobile text-on-surface md:text-headline-lg">
            Três pilares para revigorar sua estante
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Uma suíte completa pensada para o amante de livros físicos no século
            XXI.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Pilar I — scanner */}
          <div className="flex flex-col justify-between rounded-lg border border-outline-variant/30 bg-surface-container p-8 lg:col-span-7">
            <div>
              <div className="mb-3 flex items-center gap-2 font-label-sm text-label-sm text-primary">
                <Icon name="barcode_scanner" className="text-base" />
                <span>PILAR I • ENTRADA ÁGIL</span>
              </div>
              <h3 className="mb-3 font-headline-md text-headline-md text-on-surface">
                Escaneamento Instantâneo de ISBN
              </h3>
              <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
                Use a câmera do seu telefone ou webcam. Ao capturar o código de
                barras EAN-13, nossos conectores sincronizam metadados canônicos
                de bases editoriais globais.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-6">
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className="relative flex h-48 w-48 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-surface-container-high">
                  <div className="scanner-line absolute inset-x-2 h-0.5 bg-primary shadow-[0_0_12px_#5b50e6]" />
                  <div className="flex items-center justify-center gap-1 opacity-70">
                    {[1.5, 0.5, 2.5, 1, 3, 0.5, 2, 1.5, 3.5].map((w, i) => (
                      <div
                        key={i}
                        className="h-20 bg-on-surface"
                        style={{ width: `${w * 4}px` }}
                      />
                    ))}
                  </div>
                  <span className="absolute bottom-2 font-mono text-[10px] text-outline">
                    978-8535914849
                  </span>
                </div>
                <div className="w-full flex-grow space-y-3">
                  <div className="flex items-center justify-between font-caption text-caption">
                    <span className="font-semibold text-on-surface">
                      Identificando volume...
                    </span>
                    <span className="font-mono text-emerald-400">100% OK</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                    <div className="h-full w-full bg-primary-container" />
                  </div>
                  <div className="space-y-1 rounded-md border border-outline-variant/20 bg-surface-container-low p-3 font-caption text-caption">
                    {[
                      ["Título:", "Ficções"],
                      ["Autor:", "Jorge Luis Borges"],
                      ["Editora:", "Companhia das Letras"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-outline">{k}</span>
                        <span className="font-medium text-on-surface">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pilar II — métricas */}
          <div
            className="flex flex-col justify-between rounded-lg border border-outline-variant/30 bg-surface-container p-8 lg:col-span-5"
            id="metricas"
          >
            <div>
              <div className="mb-3 flex items-center gap-2 font-label-sm text-label-sm text-primary">
                <Icon name="straighten" className="text-base" />
                <span>PILAR II • ESTATURA TANGÍVEL</span>
              </div>
              <h3 className="mb-3 font-headline-md text-headline-md text-on-surface">
                Métricas Físicas da Estante
              </h3>
              <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
                Transforme números abstratos em presença palpável. Veja a altura
                real de todas as suas lombadas empilhadas.
              </p>
            </div>
            <div className="space-y-4 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-caption text-caption text-outline">
                    Altura da Pilha Total
                  </span>
                  <div className="font-headline-lg text-headline-lg tracking-tight text-primary">
                    4,82 metros
                  </div>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary-container/20 text-primary">
                  <Icon name="height" className="text-3xl" />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-outline-variant/20 bg-surface-container p-3">
                <Icon name="pets" className="text-2xl text-secondary" />
                <div className="font-caption text-caption text-on-surface-variant">
                  Equivalente à altura de uma{" "}
                  <strong className="text-on-surface">girafa adulta</strong> em
                  lombadas de livros de verdade!
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-md bg-surface-container-low p-3">
                  <span className="font-caption text-caption text-outline">
                    Exemplares
                  </span>
                  <div className="font-headline-md text-headline-md text-on-surface">
                    342
                  </div>
                </div>
                <div className="rounded-md bg-surface-container-low p-3">
                  <span className="font-caption text-caption text-outline">
                    Páginas Lidas (2025)
                  </span>
                  <div className="font-headline-md text-headline-md text-on-surface">
                    8.420
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pilar III — vitrine */}
          <div className="rounded-lg border border-outline-variant/30 bg-surface-container p-8 lg:col-span-12">
            <div className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <div className="mb-2 flex items-center gap-2 font-label-sm text-label-sm text-primary">
                  <Icon name="shelves" className="text-base" />
                  <span>PILAR III • CURADORIA & COMPARTILHAMENTO</span>
                </div>
                <h3 className="mb-2 font-headline-md text-headline-md text-on-surface">
                  Vitrine Pública & Organização por Prateleira
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Categorize por status (Lido, Lendo, Na Fila, Emprestado), crie
                  listas temáticas e compartilhe sua vitrine pessoal com um link
                  exclusivo e elegante.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container-high px-4 py-2 font-label-sm text-label-sm text-primary">
                  <Icon name="file_download" className="text-base" />
                  <span>Exportar CSV / BibTeX</span>
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container-high px-4 py-2 font-label-sm text-label-sm text-on-surface">
                  <Icon name="share" className="text-base" />
                  <span>scanteca.com/@sua-estante</span>
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {SHELF.map((b) => (
                <div
                  key={b.title}
                  className="group flex flex-col rounded-lg border border-outline-variant/20 bg-surface-container-low p-3 transition-colors hover:border-primary/40"
                >
                  <div className="mb-3 aspect-[2/3] w-full overflow-hidden rounded bg-surface-container-high">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      alt={`Capa de ${b.title}`}
                      src={b.img}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${b.tag}`}
                  >
                    {b.status}
                  </span>
                  <h4 className="truncate font-body-sm text-body-sm font-medium text-on-surface">
                    {b.title}
                  </h4>
                  <p className="truncate font-caption text-caption text-outline">
                    {b.author}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Oráculo */}
      <section
        className="relative border-t border-outline-variant/20 bg-surface-container-lowest py-24"
        id="oraculo"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary-container/5 via-transparent to-transparent" />
        <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-12">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-container/20 px-3.5 py-1.5 font-label-sm text-label-sm text-primary">
              <Icon name="neurology" className="text-base" />
              <span>INTELIGÊNCIA ARTIFICIAL VETORIAL (RAG & PGVECTOR)</span>
            </div>
            <h2 className="mb-4 font-headline-lg text-display-mobile text-on-surface md:text-headline-lg">
              O Oráculo de Bolso: Dialogue com a totalidade da sua estante
            </h2>
            <p className="font-body-lg text-body-lg leading-relaxed text-on-surface-variant">
              Não é um chatbot genérico da internet. É uma IA que consultou os
              índices, sinopses e contextos temáticos de cada um dos{" "}
              <strong>seus livros físicos</strong> para responder com precisão
              cirúrgica.
            </p>
          </div>

          <div className="glass-panel ambient-glow mx-auto max-w-4xl rounded-lg border border-primary/30 p-6 shadow-2xl sm:p-10">
            <div className="mb-6 flex items-center justify-between border-b border-outline-variant/30 pb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-on-primary">
                  <Icon name="psychology" className="text-xl" />
                </div>
                <div>
                  <h4 className="font-body-md text-body-md font-semibold text-on-surface">
                    Oráculo Bibliotheca
                  </h4>
                  <p className="font-caption text-caption text-primary">
                    Conectado a 342 volumes físicos catalogados
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-outline-variant/30 bg-surface-container-high px-3 py-1 font-mono font-caption text-caption text-on-surface-variant">
                Vector Search: 1536-dim
              </span>
            </div>

            <div className="mb-8 space-y-6">
              <div className="flex items-start justify-end gap-3.5">
                <div className="max-w-lg rounded-2xl rounded-tr-none bg-primary-container p-4 font-body-md text-body-md text-on-primary-container shadow-sm">
                  &ldquo;Quais livros da minha estante dialogam com o conceito de
                  absurdo e solidão moderna?&rdquo;
                </div>
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface">
                  <Icon name="person" className="text-sm" />
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <Icon name="auto_awesome" className="text-sm" />
                </div>
                <div className="max-w-2xl space-y-3.5 rounded-2xl rounded-tl-none border border-outline-variant/30 bg-surface-container-high/90 p-5 font-body-md text-body-md">
                  <p className="leading-relaxed text-on-surface">
                    Cruzei as premissas do seu acervo e encontrei uma ressonância
                    direta em três obras que repousam nas suas prateleiras:
                  </p>
                  <div className="space-y-2.5 pt-1">
                    {[
                      ["O Estrangeiro — Albert Camus", "(Prateleira 2, Filosofia)", "Mersault encarna o homem alheio às convenções emocionais impostas pela sociedade civil."],
                      ["A Metamorfose — Franz Kafka", "(Prateleira 1, Ficção Central Europeia)", "A desumanização utilitária do indivíduo no seio familiar e produtivo sob a lente do grotesco."],
                    ].map(([t, loc, d]) => (
                      <div
                        key={t}
                        className="flex items-start gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3"
                      >
                        <Icon
                          name="bookmark"
                          className="flex-shrink-0 text-xl text-primary"
                        />
                        <div>
                          <p className="font-body-sm text-body-sm font-semibold text-on-surface">
                            {t}{" "}
                            <span className="font-normal text-outline">
                              {loc}
                            </span>
                          </p>
                          <p className="mt-0.5 font-caption text-caption text-on-surface-variant">
                            {d}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="font-caption text-caption italic text-outline">
                    Sugestão: Você também possui{" "}
                    <strong className="text-on-surface">As Palavras</strong> de
                    Sartre na Estante A2, que pode ser o contraponto
                    memorialístico perfeito para essa leitura.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-outline-variant/20 pt-4">
              <span className="mb-2.5 block font-caption text-caption text-outline">
                Experimente perguntar ao seu acervo:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  "Cruzar autores latino-americanos da minha estante",
                  "O que ler neste fim de semana chuvoso?",
                  "Livros sobre viagens no tempo no meu acervo",
                ].map((q) => (
                  <span
                    key={q}
                    className="rounded-full border border-outline-variant/30 bg-surface-container px-3.5 py-1.5 font-caption text-caption text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
                  >
                    ✦ &ldquo;{q}&rdquo;
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Depoimentos */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24 md:px-12">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary">
            Comunidade de Curadores
          </span>
          <h2 className="mb-4 mt-2 font-headline-lg text-headline-lg-mobile text-on-surface md:text-headline-lg">
            Quem tem estante de verdade usa Scanteca
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            De bibliófilos amadores a pesquisadores acadêmicos com milhares de
            tomos físicos.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col justify-between rounded-lg border border-outline-variant/30 bg-surface-container p-6"
            >
              <div>
                <div className="mb-4 flex items-center gap-1 text-primary">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Icon key={i} name="star" className="text-sm" fill />
                  ))}
                </div>
                <p className="mb-6 font-body-md text-body-md italic leading-relaxed text-on-surface">
                  &ldquo;{t.text}&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 border-t border-outline-variant/20 pt-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${t.bg}`}
                >
                  {t.initials}
                </div>
                <div>
                  <h5 className="font-body-sm text-body-sm font-semibold text-on-surface">
                    {t.name}
                  </h5>
                  <p className="font-caption text-caption text-outline">
                    {t.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col items-center justify-between gap-4 rounded-lg border border-outline-variant/20 bg-surface-container-low p-6 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-container/20 text-primary">
              <Icon name="lock" className="text-xl" />
            </div>
            <div>
              <h5 className="font-body-sm text-body-sm font-semibold text-on-surface">
                Soberania de Dados & Exportação Livre
              </h5>
              <p className="font-caption text-caption text-outline">
                Seus dados nunca serão trancados. Exporte para JSON, CSV ou
                BibTeX quando quiser.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-outline-variant/30 bg-surface-container px-3.5 py-1.5 font-caption text-caption text-outline">
            Criptografia Ponta a Ponta
          </span>
        </div>
      </section>

      {/* 6. CTA final */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20 md:px-12" id="cadastrar">
        <div className="glass-panel relative flex flex-col items-center overflow-hidden rounded-lg border border-primary/40 p-8 text-center md:p-16">
          <div className="pointer-events-none absolute -bottom-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-container/20 blur-3xl" />
          <span className="relative mb-3 font-label-sm text-label-sm uppercase tracking-widest text-tertiary">
            Seus Livros Estão Esperando
          </span>
          <h2 className="relative mb-4 max-w-2xl font-headline-lg text-headline-lg-mobile text-on-surface md:text-headline-lg">
            Dê à sua biblioteca física o respeito e a tecnologia que ela merece.
          </h2>
          <p className="relative mb-8 max-w-xl font-body-md text-body-md leading-relaxed text-on-surface-variant">
            Comece agora mesmo a escanear seus exemplares. É gratuito, rápido e
            transforma permanentemente sua relação com a leitura analógica.
          </p>
          <div className="relative flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
            <Link
              href="/sign-up"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-8 py-4 font-label-md text-label-md text-white shadow-xl shadow-primary-container/30 transition-all hover:bg-inverse-primary active:scale-[0.98] sm:w-auto"
            >
              <Icon name="barcode_scanner" className="text-xl" />
              <span>Catalogar Meu Primeiro Livro</span>
            </Link>
            <Link
              href="/sign-in"
              className="w-full rounded-full border border-outline-variant/40 bg-surface-container px-8 py-4 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high sm:w-auto"
            >
              Já Tenho Conta
            </Link>
          </div>
          <p className="relative mt-6 font-caption text-caption text-outline">
            Sem cartão de crédito necessário • Compatível com iOS, Android, Mac
            e Windows
          </p>
        </div>
      </section>
    </div>
  );
}
