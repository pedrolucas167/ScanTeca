"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  BookOpen,
  Brain,
  CheckCircle2,
  Download,
  Frown,
  Library,
  Lock,
  PawPrint,
  Quote,
  Ruler,
  ScanLine,
  Share2,
  Sparkles,
  Star,
  User,
  X,
  Zap,
} from "lucide-react";

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
  { title: "Cem Anos de Solidão", author: "G. García Márquez", status: "Lido", tone: "from-indigo-900 to-zinc-800", tag: "text-indigo-600 dark:text-indigo-400" },
  { title: "O Estrangeiro", author: "Albert Camus", status: "Lendo", tone: "from-zinc-700 to-zinc-900", tag: "text-indigo-500 dark:text-indigo-300" },
  { title: "As Cidades Invisíveis", author: "Italo Calvino", status: "Na Fila", tone: "from-slate-700 to-indigo-950", tag: "text-zinc-500 dark:text-zinc-400" },
  { title: "A Metamorfose", author: "Franz Kafka", status: "Emprestado", tone: "from-zinc-800 to-neutral-950", tag: "text-violet-500 dark:text-violet-300" },
  { title: "Grande Sertão: Veredas", author: "Guimarães Rosa", status: "Lido", tone: "from-amber-900 to-zinc-900", tag: "text-indigo-600 dark:text-indigo-400" },
  { title: "Ensaio sobre a Cegueira", author: "José Saramago", status: "Lido", tone: "from-neutral-700 to-zinc-900", tag: "text-indigo-600 dark:text-indigo-400" },
];

const TESTIMONIALS = [
  {
    initials: "EC",
    name: "Eduardo Castello",
    role: "Professor de Literatura & Colecionador",
    text: "Eu passei 10 anos adiando catalogar meus 1.200 livros porque achava que perderia meses no Excel. No Scanteca, passei o código de barras de 100 livros em uma única tarde de café.",
    bg: "bg-indigo-600/20 text-indigo-600 dark:text-indigo-400",
  },
  {
    initials: "MS",
    name: "Marina Siqueira",
    role: "Arquiteta e Ensaísta",
    text: "O Oráculo IA é genial. Ontem perguntei qual livro do meu quarto falava sobre arquitetura medieval e ele me lembrou de um volume esquecido que ganhei há 5 anos.",
    bg: "bg-violet-600/20 text-violet-600 dark:text-violet-300",
  },
  {
    initials: "RL",
    name: "Rodrigo Lins",
    role: "Curador do Clube do Livro Noturno",
    text: "A métrica da 'altura da pilha de livros em metros' parece boba, mas ver que minha estante tem quase 5 metros me deu um orgulho absurdo da minha trajetória leitora.",
    bg: "bg-indigo-500/20 text-indigo-500 dark:text-indigo-300",
  },
];

const label = "text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400";
const card = "rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
const subCard = "rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60";

export default function LandingPage() {
  const [quoteIdx, setQuoteIdx] = useState(0);
  const quote = QUOTES[quoteIdx];

  return (
    <div className="flex flex-1 flex-col">
      {/* 1. Hero */}
      <section className="relative px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
        <div className="pointer-events-none absolute left-1/2 top-10 h-80 w-[540px] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="relative mx-auto mb-14 flex max-w-4xl flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-600/25 bg-indigo-600/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:border-indigo-400/25 dark:text-indigo-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-600 dark:bg-indigo-400" />
            Bibliotheca Personalis — O futuro do livro físico
          </div>
          <h1 className="mb-6 font-serif text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Sua estante de livros físicos,
            <br className="hidden sm:inline" /> finalmente{" "}
            <span className="italic text-indigo-600 dark:text-indigo-400">viva</span>{" "}
            e conversacional.
          </h1>
          <p className="mb-8 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Chega de planilhas engessadas e digitação exaustiva. Aponte a câmera
            para o código de barras, descubra a real estatura do seu acervo e
            dialogue com seus livros usando inteligência artificial semântica.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2.5 rounded-full bg-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-700 active:scale-[0.98]"
            >
              <BookOpen className="h-5 w-5" />
              Começar Minha Estante Grátis
            </Link>
            <Link
              href="/manifesto"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-7 py-3.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Explorar o Manifesto
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Hero grid: citações + scan widget */}
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          {/* Quote card com abas */}
          <div className={`${card} relative flex flex-col justify-between overflow-hidden p-6 sm:p-8 lg:col-span-7`}>
            <div className="mb-6 flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Quote className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Vozes Literárias
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-950">
                {QUOTES.map((q, i) => (
                  <button
                    key={q.tab}
                    onClick={() => setQuoteIdx(i)}
                    className={`rounded-full px-3 py-1 text-xs transition-all ${
                      i === quoteIdx
                        ? "bg-indigo-600/20 text-indigo-700 dark:text-indigo-200"
                        : "text-zinc-500 hover:text-foreground dark:text-zinc-400"
                    }`}
                  >
                    {q.tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex min-h-[160px] flex-col justify-center">
              <blockquote className="mb-5 font-serif text-lg italic leading-relaxed text-foreground sm:text-xl">
                &ldquo;{quote.content}&rdquo;
              </blockquote>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                — {quote.author},{" "}
                <em className="text-indigo-600 dark:text-indigo-400">{quote.work}</em>
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Acervo de Clássicos Francófonos Catalogados
              </span>
              <span className="text-zinc-400 dark:text-zinc-500">
                Localização: Prateleira Central • Volume 12
              </span>
            </div>
          </div>

          {/* Scan widget */}
          <div className={`${card} relative flex flex-col justify-between p-6 sm:p-8 lg:col-span-5`}>
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
                    Scan em Tempo Real
                  </span>
                </div>
                <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs text-indigo-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-indigo-400">
                  EAN-13 Validado
                </span>
              </div>
              <div className={`${subCard} mb-4 flex gap-4 p-4`}>
                <div className="flex h-28 w-20 flex-shrink-0 items-end justify-center rounded bg-gradient-to-br from-indigo-900 to-zinc-800 p-2 shadow-md">
                  <span className="font-serif text-[10px] italic leading-tight text-zinc-200">
                    As Palavras
                  </span>
                </div>
                <div className="flex flex-col justify-between overflow-hidden">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Filosofia / Memórias
                    </span>
                    <h4 className="truncate text-[15px] font-semibold text-foreground">
                      As Palavras
                    </h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Jean-Paul Sartre
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>216 págs</span>
                    <span>•</span>
                    <span>Nova Fronteira</span>
                    <span>•</span>
                    <span>1964</span>
                  </div>
                </div>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                <div className={`${subCard} flex flex-col p-2.5`}>
                  <span className="text-zinc-500 dark:text-zinc-400">ISBN-13</span>
                  <span className="font-mono font-medium text-foreground">
                    978-8520932018
                  </span>
                </div>
                <div className={`${subCard} flex flex-col p-2.5`}>
                  <span className="text-zinc-500 dark:text-zinc-400">Espessura Fís.</span>
                  <span className="font-mono font-medium text-foreground">
                    1,4 cm (Estante A2)
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400">
              <span className="flex items-center gap-1">
                <Brain className="h-4 w-4" />
                Vetorizado no Oráculo IA
              </span>
              <span className="font-semibold">Sinopse Extraída (100%)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Problema vs Solução */}
      <section className="border-y border-zinc-200 bg-zinc-50 py-20 dark:border-zinc-800 dark:bg-zinc-950" id="manifesto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <span className={label}>A Transição Bibliográfica</span>
            <h2 className="mb-4 mt-2 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
              O fardo analógico vs. A precisão do Scanteca
            </h2>
            <p className="text-[15px] text-zinc-600 dark:text-zinc-400">
              Amamos o cheiro do papel e o toque da capa dura. O que detestamos é
              a burocracia de manter nosso acervo ordenado.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="flex flex-col justify-between rounded-2xl border border-red-500/20 bg-zinc-50 p-8 dark:bg-zinc-900/50">
              <div>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-500">
                  <X className="h-6 w-6" />
                </div>
                <h3 className="mb-3 font-serif text-2xl font-semibold text-foreground">
                  O Fardo do Acervo Inerte
                </h3>
                <p className="mb-6 text-[15px] text-zinc-600 dark:text-zinc-400">
                  Planilhas confusas esquecidas no Google Drive, digitação maçante
                  de título por título e compras acidentais de exemplares
                  repetidos na livraria.
                </p>
                <ul className="space-y-3.5">
                  {[
                    ["Digitação Lenta:", "3 a 5 minutos gastados inserindo autor, editora, ano e sinopse por volume."],
                    ["Amnésia de Empréstimos:", "Livros emprestados a amigos que desaparecem no esquecimento."],
                    ["Zero Interatividade:", "Milhares de páginas empilhadas incapazes de responder às suas dúvidas."],
                  ].map(([t, d]) => (
                    <li key={t} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                      <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                      <span><strong className="text-foreground">{t}</strong> {d}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 flex items-center gap-2 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <Frown className="h-4 w-4" />
                84% dos colecionadores desistem de catalogar após o 50º livro.
              </div>
            </div>

            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-indigo-600/30 bg-white p-8 shadow-lg shadow-indigo-600/5 dark:bg-zinc-900">
              <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-indigo-600/10 blur-2xl" />
              <div className="relative">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-600/40 bg-indigo-600/15 text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="mb-3 font-serif text-2xl font-semibold text-foreground">
                  O Padrão Scanteca
                </h3>
                <p className="mb-6 text-[15px] text-zinc-600 dark:text-zinc-400">
                  A tecnologia RAG e leitura de código de barras a serviço da sua
                  sensibilidade literária. Um segundo por livro, precisão perene.
                </p>
                <ul className="space-y-3.5">
                  {[
                    ["Catalogação Instantânea:", "Aponte a câmera e o ISBN puxa capa em alta definição, autor, paginação e sinopse em 2s."],
                    ["Mapeamento Físico:", "Saiba em qual estante, prateleira ou caixa cada título descansa."],
                    ["Oráculo Cognitivo (IA):", "Faça perguntas conceituais e cruze autores da sua própria coleção."],
                  ].map(([t, d]) => (
                    <li key={t} className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
                      <span><strong className="text-foreground">{t}</strong> {d}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative mt-8 flex items-center gap-2 border-t border-zinc-200 pt-6 text-xs text-indigo-600 dark:border-zinc-800 dark:text-indigo-400">
                <Zap className="h-4 w-4" />
                Catalogação 15x mais rápida que qualquer método tradicional.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Pilares — bento grid */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6" id="pilares">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <span className={label}>Engenharia Bibliófila</span>
          <h2 className="mb-4 mt-2 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
            Três pilares para revigorar sua estante
          </h2>
          <p className="text-[15px] text-zinc-600 dark:text-zinc-400">
            Uma suíte completa pensada para o amante de livros físicos no século XXI.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Pilar I — scanner */}
          <div className={`${card} flex flex-col justify-between p-8 lg:col-span-7`}>
            <div>
              <div className={`mb-3 flex items-center gap-2 ${label}`}>
                <ScanLine className="h-4 w-4" />
                Pilar I • Entrada Ágil
              </div>
              <h3 className="mb-3 font-serif text-2xl font-semibold text-foreground">
                Escaneamento Instantâneo de ISBN
              </h3>
              <p className="mb-6 text-[15px] text-zinc-600 dark:text-zinc-400">
                Use a câmera do seu telefone ou webcam. Ao capturar o código de
                barras EAN-13, nossos conectores sincronizam metadados canônicos
                de bases editoriais globais.
              </p>
            </div>
            <div className={`${subCard} relative overflow-hidden p-6`}>
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className="relative flex h-48 w-48 flex-shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-indigo-600/40 bg-zinc-100 dark:bg-zinc-800">
                  <div className="flex items-center justify-center gap-1 opacity-70">
                    {[1.5, 0.5, 2.5, 1, 3, 0.5, 2, 1.5, 3.5].map((w, i) => (
                      <div key={i} className="h-20 bg-zinc-800 dark:bg-zinc-200" style={{ width: `${w * 4}px` }} />
                    ))}
                  </div>
                  <span className="absolute bottom-2 font-mono text-[10px] text-zinc-500">
                    978-8535914849
                  </span>
                </div>
                <div className="w-full flex-grow space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Identificando volume...</span>
                    <span className="font-mono text-emerald-500">100% OK</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div className="h-full w-full bg-indigo-600" />
                  </div>
                  <div className={`${subCard} space-y-1 p-3 text-xs`}>
                    {[["Título:", "Ficções"], ["Autor:", "Jorge Luis Borges"], ["Editora:", "Companhia das Letras"]].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400">{k}</span>
                        <span className="font-medium text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pilar II — métricas */}
          <div className={`${card} flex flex-col justify-between p-8 lg:col-span-5`} id="metricas">
            <div>
              <div className={`mb-3 flex items-center gap-2 ${label}`}>
                <Ruler className="h-4 w-4" />
                Pilar II • Estatura Tangível
              </div>
              <h3 className="mb-3 font-serif text-2xl font-semibold text-foreground">
                Métricas Físicas da Estante
              </h3>
              <p className="mb-6 text-[15px] text-zinc-600 dark:text-zinc-400">
                Transforme números abstratos em presença palpável. Veja a altura
                real de todas as suas lombadas empilhadas.
              </p>
            </div>
            <div className={`${subCard} space-y-4 p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Altura da Pilha Total</span>
                  <div className="font-serif text-4xl font-semibold tracking-tight text-indigo-600 dark:text-indigo-400">
                    4,82 metros
                  </div>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-indigo-600/30 bg-indigo-600/15 text-indigo-600 dark:text-indigo-400">
                  <Ruler className="h-7 w-7" />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <PawPrint className="h-6 w-6 text-indigo-500 dark:text-indigo-300" />
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Equivalente à altura de uma{" "}
                  <strong className="text-foreground">girafa adulta</strong> em
                  lombadas de livros de verdade!
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className={`${subCard} p-3`}>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Exemplares</span>
                  <div className="font-serif text-2xl font-semibold text-foreground">342</div>
                </div>
                <div className={`${subCard} p-3`}>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Páginas Lidas (2025)</span>
                  <div className="font-serif text-2xl font-semibold text-foreground">8.420</div>
                </div>
              </div>
            </div>
          </div>

          {/* Pilar III — vitrine */}
          <div className={`${card} p-8 lg:col-span-12`}>
            <div className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <div className={`mb-2 flex items-center gap-2 ${label}`}>
                  <Library className="h-4 w-4" />
                  Pilar III • Curadoria & Compartilhamento
                </div>
                <h3 className="mb-2 font-serif text-2xl font-semibold text-foreground">
                  Vitrine Pública & Organização por Prateleira
                </h3>
                <p className="text-[15px] text-zinc-600 dark:text-zinc-400">
                  Categorize por status (Lido, Lendo, Na Fila, Emprestado), crie
                  listas temáticas e compartilhe sua vitrine pessoal com um link
                  exclusivo e elegante.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-4 py-2 text-[11px] font-semibold text-indigo-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-indigo-400">
                  <Download className="h-4 w-4" />
                  Exportar CSV / BibTeX
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-4 py-2 text-[11px] font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  <Share2 className="h-4 w-4" />
                  scanteca.com/@sua-estante
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {SHELF.map((b) => (
                <div key={b.title} className={`${subCard} group flex flex-col p-3 transition-colors hover:border-indigo-600/40`}>
                  <div className={`mb-3 flex aspect-[2/3] w-full items-end justify-center overflow-hidden rounded bg-gradient-to-br ${b.tone} p-2`}>
                    <span className="text-center font-serif text-[10px] italic leading-tight text-zinc-200 transition-transform duration-300 group-hover:scale-105">
                      {b.title}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${b.tag}`}>
                    {b.status}
                  </span>
                  <h4 className="truncate text-sm font-medium text-foreground">{b.title}</h4>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{b.author}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Oráculo */}
      <section className="relative border-t border-zinc-200 bg-zinc-50 py-24 dark:border-zinc-800 dark:bg-zinc-950" id="oraculo">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-600/5 via-transparent to-transparent" />
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-600/30 bg-indigo-600/15 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <Brain className="h-4 w-4" />
              Inteligência Artificial Vetorial (RAG & pgvector)
            </div>
            <h2 className="mb-4 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
              O Oráculo de Bolso: dialogue com a totalidade da sua estante
            </h2>
            <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
              Não é um chatbot genérico da internet. É uma IA que consultou os
              índices, sinopses e contextos temáticos de cada um dos{" "}
              <strong className="text-foreground">seus livros físicos</strong>{" "}
              para responder com precisão cirúrgica.
            </p>
          </div>

          <div className="mx-auto max-w-4xl rounded-2xl border border-indigo-600/30 bg-white/80 p-6 shadow-2xl shadow-indigo-600/10 backdrop-blur-md dark:bg-zinc-900/80 sm:p-10">
            <div className="mb-6 flex items-center justify-between border-b border-zinc-200 pb-6 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-[15px] font-semibold text-foreground">Oráculo Bibliotheca</h4>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">
                    Conectado a 342 volumes físicos catalogados
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 font-mono text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400">
                Vector Search: 1536-dim
              </span>
            </div>

            <div className="mb-8 space-y-6">
              <div className="flex items-start justify-end gap-3.5">
                <div className="max-w-lg rounded-2xl rounded-tr-none bg-indigo-600 p-4 text-[15px] text-white shadow-sm">
                  &ldquo;Quais livros da minha estante dialogam com o conceito de
                  absurdo e solidão moderna?&rdquo;
                </div>
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  <User className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-600 dark:text-indigo-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="max-w-2xl space-y-3.5 rounded-2xl rounded-tl-none border border-zinc-200 bg-zinc-100/90 p-5 text-[15px] dark:border-zinc-800 dark:bg-zinc-800/90">
                  <p className="leading-relaxed text-foreground">
                    Cruzei as premissas do seu acervo e encontrei uma ressonância
                    direta em três obras que repousam nas suas prateleiras:
                  </p>
                  <div className="space-y-2.5 pt-1">
                    {[
                      ["O Estrangeiro — Albert Camus", "(Prateleira 2, Filosofia)", "Mersault encarna o homem alheio às convenções emocionais impostas pela sociedade civil."],
                      ["A Metamorfose — Franz Kafka", "(Prateleira 1, Ficção Central Europeia)", "A desumanização utilitária do indivíduo no seio familiar e produtivo sob a lente do grotesco."],
                    ].map(([t, loc, d]) => (
                      <div key={t} className={`${subCard} flex items-start gap-3 p-3`}>
                        <Bookmark className="h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {t} <span className="font-normal text-zinc-500">{loc}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
                    Sugestão: Você também possui{" "}
                    <strong className="text-foreground">As Palavras</strong> de
                    Sartre na Estante A2, que pode ser o contraponto
                    memorialístico perfeito para essa leitura.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <span className="mb-2.5 block text-xs text-zinc-500 dark:text-zinc-400">
                Experimente perguntar ao seu acervo:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  "Cruzar autores latino-americanos da minha estante",
                  "O que ler neste fim de semana chuvoso?",
                  "Livros sobre viagens no tempo no meu acervo",
                ].map((q) => (
                  <span key={q} className="rounded-full border border-zinc-200 bg-zinc-100 px-3.5 py-1.5 text-xs text-zinc-600 transition-colors hover:text-indigo-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-indigo-400">
                    ✦ &ldquo;{q}&rdquo;
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Depoimentos */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <span className={label}>Comunidade de Curadores</span>
          <h2 className="mb-4 mt-2 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
            Quem tem estante de verdade usa Scanteca
          </h2>
          <p className="text-[15px] text-zinc-600 dark:text-zinc-400">
            De bibliófilos amadores a pesquisadores acadêmicos com milhares de
            tomos físicos.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className={`${card} flex flex-col justify-between p-6`}>
              <div>
                <div className="mb-4 flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mb-6 text-[15px] italic leading-relaxed text-foreground">
                  &ldquo;{t.text}&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${t.bg}`}>
                  {t.initials}
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-foreground">{t.name}</h5>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className={`${subCard} mt-16 flex flex-col items-center justify-between gap-4 p-6 text-center sm:flex-row sm:text-left`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600/15 text-indigo-600 dark:text-indigo-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground">
                Soberania de Dados & Exportação Livre
              </h5>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Seus dados nunca serão trancados. Exporte para JSON, CSV ou BibTeX
                quando quiser.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Criptografia Ponta a Ponta
          </span>
        </div>
      </section>

      {/* 6. CTA final */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" id="cadastrar">
        <div className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-indigo-600/40 bg-white/80 p-8 text-center backdrop-blur-md dark:bg-zinc-900/80 md:p-16">
          <div className="pointer-events-none absolute -bottom-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
          <span className={`${label} relative mb-3`}>Seus Livros Estão Esperando</span>
          <h2 className="relative mb-4 max-w-2xl font-serif text-3xl font-semibold text-foreground sm:text-4xl">
            Dê à sua biblioteca física o respeito e a tecnologia que ela merece.
          </h2>
          <p className="relative mb-8 max-w-xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Comece agora mesmo a escanear seus exemplares. É gratuito, rápido e
            transforma permanentemente sua relação com a leitura analógica.
          </p>
          <div className="relative flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-8 py-4 text-sm font-semibold text-white shadow-xl shadow-indigo-600/30 transition-all hover:bg-indigo-700 active:scale-[0.98] sm:w-auto"
            >
              <ScanLine className="h-5 w-5" />
              Catalogar Meu Primeiro Livro
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex w-full items-center justify-center rounded-full border border-zinc-300 bg-white px-8 py-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 sm:w-auto"
            >
              Já Tenho Conta
            </Link>
          </div>
          <p className="relative mt-6 text-xs text-zinc-500 dark:text-zinc-400">
            Sem cartão de crédito necessário • Compatível com iOS, Android, Mac e
            Windows
          </p>
        </div>
      </section>
    </div>
  );
}
