"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  Bookmark,
  Heart,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  genre: string | null;
  pages: number | null;
  status: string;
  synopsis: string | null;
  createdAt: Date;
}

interface Recommendation {
  id: string;
  title: string;
  author: string;
  cover: string | null;
  score: number;
  reason: string;
  tags: string[];
}

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

function buildProfileMock() {
  return {
    topGenres: [
      { label: "Filosofia", score: 0.92 },
      { label: "Ficção Histórica", score: 0.84 },
      { label: "Temas Sociais", score: 0.78 },
      { label: "Ensaios", score: 0.65 },
      { label: "Existencialismo", score: 0.61 },
    ],
    topAuthors: [
      "Albert Camus",
      "Jean-Paul Sartre",
      "Jorge Luis Borges",
      "Italo Calvino",
    ],
    topKeywords: [
      "absurdo",
      "identidade",
      "desigualdade",
      "liberdade",
      "memória",
      "metamorfose",
    ],
    avgPages: 240,
    readingPace: 22,
  };
}

function buildRecommendationsMock(): Recommendation[] {
  return [
    {
      id: "rec-1",
      title: "A Nausea",
      author: "Jean-Paul Sartre",
      cover: null,
      score: 0.94,
      reason:
        "Aprofunda o existencialismo que você gosta em Camus e explora a liberdade individual.",
      tags: ["Filosofia", "Existencialismo"],
    },
    {
      id: "rec-2",
      title: "O Processo",
      author: "Franz Kafka",
      cover: null,
      score: 0.89,
      reason:
        "Tema social e absurdo em diálogo com a sua leitura de Metamorfose.",
      tags: ["Ficção", "Temas Sociais"],
    },
    {
      id: "rec-3",
      title: "A Peste",
      author: "Albert Camus",
      cover: null,
      score: 0.87,
      reason:
        "Do mesmo autor de O Estrangeiro, com questões sociais e existenciais.",
      tags: ["Filosofia", "Temas Sociais"],
    },
    {
      id: "rec-4",
      title: "O Mundo de Sofia",
      author: "Jostein Gaarder",
      cover: null,
      score: 0.81,
      reason:
        "Introdução à filosofia que conecta vários autores do seu interesse.",
      tags: ["Filosofia", "Ensaios"],
    },
  ];
}

export default function DescobrirClient({ books }: { books: Book[] }) {
  const profile = buildProfileMock();
  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    buildRecommendationsMock()
  );
  const [feedback, setFeedback] = useState<Record<string, "liked" | "dismissed">>(
    {}
  );

  const handleFeedback = (
    id: string,
    kind: "liked" | "dismissed"
  ) => {
    setFeedback((prev) => ({ ...prev, [id]: kind }));
    if (kind === "dismissed") {
      setRecommendations((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const graphNodes = [
    { label: "Filosofia", x: 20, y: 20, size: "lg" },
    { label: "Existencialismo", x: 55, y: 15, size: "md" },
    { label: "Ficção Histórica", x: 75, y: 45, size: "md" },
    { label: "Temas Sociais", x: 30, y: 55, size: "lg" },
    { label: "Borges", x: 60, y: 70, size: "sm" },
    { label: "Camus", x: 10, y: 75, size: "sm" },
    { label: "Sartre", x: 85, y: 75, size: "sm" },
    { label: "Memória", x: 45, y: 40, size: "sm" },
    { label: "Absurdo", x: 80, y: 30, size: "sm" },
    { label: "Liberdade", x: 15, y: 45, size: "sm" },
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Descoberta
          </span>
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Recomendações para você
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          A gente analisa seus livros, gêneros e temas favoritos para sugerir
          obras que conversam com o seu perfil de leitor.
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <div className="mb-4 flex items-center gap-2">
          <Icon name="network_node" className="text-xl text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-semibold text-foreground">Afinidade & Grafo Pessoal</h2>
        </div>
        <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
          Mapa dos temas, autores e gêneros que mais aparecem no seu acervo e
          definem seu gosto.
        </p>

        <div className="relative h-72 w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 sm:h-80">
          <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
            {graphNodes.slice(0, 6).map((from, i) => {
              const to = graphNodes[(i + 3) % graphNodes.length];
              return (
                <line
                  key={`line-${i}`}
                  x1={`${from.x}%`}
                  y1={`${from.y}%`}
                  x2={`${to.x}%`}
                  y2={`${to.y}%`}
                  className="stroke-zinc-300 dark:stroke-zinc-700"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              );
            })}
          </svg>
          {graphNodes.map((node) => (
            <div
              key={node.label}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <span
                className={`inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-transform hover:scale-105 dark:border-zinc-700 dark:bg-zinc-800 ${
                  node.size === "lg"
                    ? "text-sm"
                    : node.size === "md"
                    ? "text-xs"
                    : "text-[10px]"
                }`}
              >
                {node.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Autores de destaque</span>
            <p className="mt-1 text-sm font-medium text-foreground">
              {profile.topAuthors.join(", ")}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Média de páginas</span>
            <p className="mt-1 text-sm font-medium text-foreground">
              {profile.avgPages} págs
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Ritmo de leitura</span>
            <p className="mt-1 text-sm font-medium text-foreground">
              {profile.readingPace} págs/dia
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Livros catalogados</span>
            <p className="mt-1 text-sm font-medium text-foreground">{books.length}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recomendados para você</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            baseado no perfil local
          </span>
        </div>

        {recommendations.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <Sparkles className="mx-auto h-8 w-8 text-zinc-400" />
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Você curou todas as sugestões. Volte em breve para novas
              recomendações.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((rec) => (
              <article
                key={rec.id}
                className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
              >
                <div className="mb-4 flex items-start gap-4">
                  <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
                    {rec.cover ? (
                      <Image
                        src={rec.cover}
                        alt={`Capa de ${rec.title}`}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                        <BookOpen className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {Math.round(rec.score * 100)}% match
                      </span>
                    </div>
                    <h3 className="mt-1 truncate font-semibold text-foreground">
                      {rec.title}
                    </h3>
                    <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                      {rec.author}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {rec.reason}
                    </p>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap gap-2">
                  {rec.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleFeedback(rec.id, "liked")}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                      feedback[rec.id] === "liked"
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    Gostei
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(rec.id, "dismissed")}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    Não é pra mim
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href={`/search-add?q=${encodeURIComponent(rec.title)}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    Adicionar à fila
                  </Link>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-zinc-200 p-2 text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    aria-label="Mais opções"
                  >
                    <Heart className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-foreground">Quer refinar as sugestões?</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Quanto mais livros você avalia e registra no Diário, melhor fica o
              perfil.
            </p>
          </div>
          <Link
            href="/diario"
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Ir para o Diário
            <Icon name="arrow_forward" className="text-sm" />
          </Link>
        </div>
      </div>
    </main>
  );
}
