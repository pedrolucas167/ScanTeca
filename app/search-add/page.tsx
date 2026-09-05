"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, BookOpen, Check, Plus, Search } from "lucide-react";

interface SearchResult {
  googleId: string;
  title: string;
  subtitle: string | null;
  author: string;
  publishedDate: string | null;
  synopsis: string | null;
  pages: number | null;
  genre: string | null;
  isbn: string | null;
  coverUrl: string | null;
}

export default function SearchAddPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setMessage(null);
    setSearched(true);

    try {
      const res = await fetch("/api/search-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();

      if (res.ok) {
        setResults(data.results || []);
        if ((data.results || []).length === 0) {
          setMessage("Nenhum livro encontrado. Tente outro termo.");
        }
      } else {
        setMessage(data.error || "Erro ao buscar livros");
      }
    } catch {
      setMessage("Erro de rede ao buscar");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (book: SearchResult) => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isbn: book.isbn || "",
          title: book.subtitle
            ? `${book.title}: ${book.subtitle}`
            : book.title,
          author: book.author,
          publishedDate: book.publishedDate,
          synopsis: book.synopsis,
          coverUrl: book.coverUrl,
          genre: book.genre,
          pages: book.pages,
          status: "TO_READ",
          collection: "Minha Biblioteca",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAddedIds((prev) => new Set(prev).add(book.googleId));
        setMessage(`"${book.title}" adicionado ao catálogo!`);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage(data.error || "Erro ao adicionar livro");
      }
    } catch {
      setMessage("Erro de rede ao adicionar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao catálogo
        </Link>

        <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold text-foreground">
          <Search className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          Buscar Livro
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Pesquise por título, autor ou ISBN e adicione com um clique. Gênero e
          páginas são preenchidos automaticamente quando disponíveis.
        </p>

        <form onSubmit={handleSearch} className="mb-6 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: Dom Casmurro, Machado de Assis, 97885..."
            className="flex-1 rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm text-foreground placeholder-zinc-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </form>

        {message && (
          <div
            className={`mb-6 rounded-lg p-3 text-sm font-medium ${
              message.includes("adicionado")
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {message}
          </div>
        )}

        {searched && !loading && results.length === 0 && !message && (
          <div className="flex flex-col items-center py-16 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum resultado. Tente outro termo ou{" "}
              <Link href="/manual-add" className="text-indigo-600 underline">
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
                className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                  {book.coverUrl ? (
                    <Image
                      src={book.coverUrl}
                      alt={`Capa de ${book.title}`}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-400">
                      <BookOpen className="h-8 w-8" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-foreground">
                    {book.title}
                    {book.subtitle && (
                      <span className="font-normal text-zinc-500">
                        : {book.subtitle}
                      </span>
                    )}
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {book.author}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                    {book.publishedDate && <span>{book.publishedDate}</span>}
                    {book.pages && <span>{book.pages} págs</span>}
                    {book.genre && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">
                        {book.genre}
                      </span>
                    )}
                    {book.isbn && (
                      <span className="font-mono text-[10px]">{book.isbn}</span>
                    )}
                  </div>
                  {book.synopsis && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {book.synopsis}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-start">
                  <button
                    onClick={() => handleAdd(book)}
                    disabled={loading || added}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                      added
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                    }`}
                  >
                    {added ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Adicionado
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
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
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              Ir para o catálogo →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
