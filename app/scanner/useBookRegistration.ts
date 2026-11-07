import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookDraft } from "./BookPreviewSheet";
import type { SearchResult } from "./useBookSearch";

export function useBookRegistration(setMessage: (message: string | null) => void) {
  const router = useRouter();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ googleId: string; book: BookDraft } | null>(null);
  const [saving, setSaving] = useState(false);

  const openPreview = (book: SearchResult) => {
    setPreview({
      googleId: book.googleId,
      book: {
        title: book.title,
        author: book.author,
        publishedDate: book.publishedDate,
        synopsis: book.synopsis,
        coverUrl: book.coverUrl,
        genre: book.genre,
        pages: book.pages,
        isbn: book.isbn,
        collection: "Minha Biblioteca",
      },
    });
  };

  const saveBook = async (status: string) => {
    if (!preview) return;
    const { book: previewBook, googleId } = preview;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isbn: previewBook.isbn,
          title: previewBook.title,
          author: previewBook.author,
          publishedDate: previewBook.publishedDate,
          synopsis: previewBook.synopsis,
          coverUrl: previewBook.coverUrl,
          genre: previewBook.genre,
          pages: previewBook.pages,
          status,
          collection: previewBook.collection,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.message === "Livro já cadastrado" && data.book?.id) {
          setPreview(null);
          router.push(`/books/${data.book.id}`);
          return;
        }
        setAddedIds((prev) => new Set(prev).add(googleId));
        setMessage(`"${previewBook.title}" adicionado ao catálogo!`);
        setPreview(null);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage(data.error || "Erro ao adicionar livro");
      }
    } catch {
      setMessage("Erro de rede ao adicionar");
    } finally {
      setSaving(false);
    }
  };

  return {
    addedIds,
    previewBook: preview?.book,
    saving,
    openPreview,
    saveBook,
    closePreview: () => setPreview(null),
  };
}
