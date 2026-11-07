import { useEffect, useRef, useState } from "react";
import { logBookSearchTiming, startBookSearchTiming } from "./book-search-timing";

export interface SearchResult {
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

export function useBookSearch(setMessage: (message: string | null) => void) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  async function performSearch(searchQuery: string) {
    if (!searchQuery) return;

    clearTimeout(searchTimeoutRef.current);
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setMessage(null);
    setSearched(true);

    const startedAt = startBookSearchTiming();
    let status: number | undefined;
    let outcome: "ok" | "http-error" | "request-error" = "request-error";
    try {
      const res = await fetch("/api/search-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
        signal: controller.signal,
      });

      status = res.status;
      const data = await res.json();
      outcome = res.ok ? "ok" : "http-error";

      if (controller.signal.aborted) return;

      if (res.ok) {
        const books = data.results || [];
        setResults(books);
        if (books.length === 0) {
          setMessage("Nenhum livro encontrado. Tente outro termo.");
        }
      } else {
        setMessage(data.error || "Erro ao buscar livros");
      }
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      setMessage("Erro de rede ao buscar");
    } finally {
      logBookSearchTiming(startedAt, {
        stage: "results",
        outcome: controller.signal.aborted ? "aborted" : outcome,
        status,
      });
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => () => {
    clearTimeout(searchTimeoutRef.current);
    abortControllerRef.current?.abort();
  }, []);

  function changeQuery(value: string) {
    setQuery(value);
    clearTimeout(searchTimeoutRef.current);

    const trimmed = value.trim();
    if (trimmed) {
      searchTimeoutRef.current = setTimeout(() => void performSearch(trimmed), 500);
      return;
    }

    abortControllerRef.current?.abort();
    setResults([]);
    setSearched(false);
    setLoading(false);
    setMessage(null);
  }

  return { query, results, loading, searched, changeQuery, searchNow: () => performSearch(query.trim()) };
}
