import { isTitleSimilar, isAuthorSimilar } from "./book-cover";

interface OpenLibraryDoc {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibraryDoc[];
}

/**
 * Busca o ano da PRIMEIRA publicação da obra (não da edição) no Open Library.
 * "Assim Falou Zaratustra" → 1883, mesmo que a edição escaneada seja de 2021.
 */
export async function findOriginalPublishYear({
  title,
  author,
  isbn,
}: {
  title?: string;
  author?: string;
  isbn?: string;
}): Promise<number | null> {
  const cleanedIsbn = isbn ? isbn.replace(/[^0-9X]/gi, "") : "";

  // ISBN → edição exata → work → ano da primeira publicação
  // (guarda de tamanho: placeholders tipo "MANUAL-<uuid>" viram dígitos
  // soltos após o replace e não são ISBNs válidos)
  if (cleanedIsbn.length === 10 || cleanedIsbn.length === 13) {
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?isbn=${encodeURIComponent(
          cleanedIsbn
        )}&fields=first_publish_year&limit=1`
      );
      if (res.ok) {
        const data = (await res.json()) as OpenLibrarySearchResponse;
        const year = data.docs?.[0]?.first_publish_year;
        if (typeof year === "number") return year;
      }
    } catch (err) {
      console.error("[original-date] Open Library ISBN error:", err);
    }
  }

  if (!title) return null;

  // Título + autor → valida o match antes de aceitar o ano
  try {
    const params = new URLSearchParams({ title, limit: "10" });
    if (author) params.set("author", author);
    params.set("fields", "title,author_name,first_publish_year");

    const res = await fetch(`https://openlibrary.org/search.json?${params}`);
    if (!res.ok) return null;

    const data = (await res.json()) as OpenLibrarySearchResponse;
    const queryTitle = title.toLowerCase().trim();
    const queryAuthor = (author || "").toLowerCase().trim();

    for (const doc of data.docs || []) {
      if (typeof doc.first_publish_year !== "number") continue;
      if (!isTitleSimilar(queryTitle, (doc.title || "").toLowerCase()))
        continue;
      if (
        queryAuthor &&
        !(doc.author_name || []).some((a) => isAuthorSimilar(queryAuthor, a))
      )
        continue;
      return doc.first_publish_year;
    }
  } catch (err) {
    console.error("[original-date] Open Library search error:", err);
  }

  return null;
}

/** Extrai o ano (4 dígitos) de uma publishedDate em qualquer formato. */
export function extractYear(date: string | null | undefined): number | null {
  if (!date) return null;
  const match = date.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}
