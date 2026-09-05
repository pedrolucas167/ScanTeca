"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publishedDate: string | null;
  synopsis: string | null;
  coverUrl: string | null;
  status: "READ" | "TO_READ" | "WISHLIST";
  collection: string;
  notes: string | null;
  rating: number | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

const statusLabels: Record<string, string> = {
  READ: "Lido",
  TO_READ: "A ler",
  WISHLIST: "Desejo",
};

const statusClasses: Record<string, string> = {
  READ: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  TO_READ: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  WISHLIST: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

export default function Catalog({ books }: { books: Book[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [collectionFilter, setCollectionFilter] = useState<string>("");
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [bookList, setBookList] = useState<Book[]>(books);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const collections = useMemo(
    () => Array.from(new Set(bookList.map((b) => b.collection))).sort(),
    [bookList]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookList.filter((book) => {
      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.isbn.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || book.status === statusFilter;
      const matchesCollection =
        !collectionFilter || book.collection === collectionFilter;
      return matchesQuery && matchesStatus && matchesCollection;
    });
  }, [bookList, query, statusFilter, collectionFilter]);

  const handleEdit = (book: Book) => {
    setEditingBook({ ...book });
  };

  const handleSave = async () => {
    if (!editingBook) return;
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/books", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBook.id,
          title: editingBook.title,
          author: editingBook.author,
          publishedDate: editingBook.publishedDate,
          synopsis: editingBook.synopsis,
          coverUrl: editingBook.coverUrl,
          status: editingBook.status,
          collection: editingBook.collection,
          notes: editingBook.notes,
          rating: editingBook.rating,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setBookList((prev) =>
          prev.map((b) => (b.id === data.book.id ? data.book : b))
        );
        setEditingBook(null);
        setMessage(`✓ ${data.book.title} atualizado`);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage(data.error || "Erro ao atualizar");
      }
    } catch {
      setMessage("Erro de rede");
    } finally {
      setLoading(false);
    }
  };

  const searchAndSaveCover = async (book: Book) => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/search-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: book.title,
          author: book.author,
          isbn: book.isbn,
        }),
      });

      const data = await res.json();

      if (res.ok && data.coverUrl) {
        const saveRes = await fetch("/api/books", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: book.id,
            coverUrl: data.coverUrl,
          }),
        });

        const saveData = await saveRes.json();

        if (saveRes.ok) {
          setBookList((prev) =>
            prev.map((b) => (b.id === book.id ? { ...b, coverUrl: data.coverUrl } : b))
          );
          setMessage(`✓ Capa encontrada para ${book.title}`);
          setTimeout(() => setMessage(null), 3000);
          return data.coverUrl;
        } else {
          setMessage(saveData.error || "Erro ao salvar capa");
        }
      } else {
        setMessage(data.error || "Nenhuma capa encontrada");
      }
    } catch {
      setMessage("Erro ao buscar capa");
    } finally {
      setLoading(false);
    }
    return null;
  };

  const handleSearchCover = async () => {
    if (!editingBook) return;
    const coverUrl = await searchAndSaveCover(editingBook);
    if (coverUrl && editingBook) {
      setEditingBook({ ...editingBook, coverUrl });
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-zinc-200 bg-gradient-to-br from-indigo-50 to-white px-4 py-12 text-center dark:border-zinc-800 dark:from-indigo-950/20 dark:to-zinc-950">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          📚 Minha Biblioteca
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-zinc-600 dark:text-zinc-400">
          Organize seus livros: lidos, a ler e lista de desejos.
        </p>
        <div className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/scanner"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-indigo-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
            Escanear Livro
          </Link>
          <Link
            href="/manual-add"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            ➕ Adicionar Manual
          </Link>
        </div>
      </section>

      <section className="flex-1 px-4 py-8">
        <div className="mx-auto mb-6 max-w-6xl space-y-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, autor ou ISBN..."
            className="w-full rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm text-foreground placeholder-zinc-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value="">Todos os status</option>
              <option value="READ">Lidos</option>
              <option value="TO_READ">A ler</option>
              <option value="WISHLIST">Desejos</option>
            </select>
            <select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value="">Todas as coleções</option>
              {collections.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {message && (
          <div className="mx-auto mb-6 max-w-6xl rounded-lg bg-green-100 p-3 text-sm font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
            {message}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 text-6xl">📖</div>
            <h2 className="text-xl font-semibold text-foreground">
              {query || statusFilter || collectionFilter
                ? "Nenhum livro encontrado"
                : "Nenhum livro cadastrado"}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              {query || statusFilter || collectionFilter
                ? "Tente ajustar os filtros."
                : "Use o scanner ou adicione manualmente livros ao seu catálogo."}
            </p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((book) => (
              <article
                key={book.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="relative flex h-56 items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                  {book.coverUrl ? (
                    <Image
                      src={book.coverUrl}
                      alt={`Capa de ${book.title}`}
                      fill
                      className="object-contain p-4 transition-transform group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-zinc-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                      </svg>
                      <span className="mt-1 text-xs">Sem capa</span>
                      <button
                        onClick={() => searchAndSaveCover(book)}
                        disabled={loading}
                        className="mt-2 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {loading ? "Buscando..." : "🔍 Buscar capa"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClasses[book.status]}`}
                    >
                      {statusLabels[book.status]}
                    </span>
                    {book.rating ? (
                      <span className="text-xs text-yellow-500">
                        {"★".repeat(book.rating)}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
                    {book.title}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {book.author}
                  </p>
                  {book.publishedDate && (
                    <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                      {book.publishedDate}
                    </p>
                  )}
                  {book.synopsis && (
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {book.synopsis}
                    </p>
                  )}
                  {book.notes && (
                    <p className="mt-2 line-clamp-2 text-xs italic text-zinc-500 dark:text-zinc-400">
                      Nota: {book.notes}
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-3">
                    <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-mono text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {book.collection}
                    </span>
                    <button
                      onClick={() => handleEdit(book)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Edit Modal */}
      {editingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Editar Livro
            </h2>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Título
              </label>
              <input
                type="text"
                value={editingBook.title}
                onChange={(e) =>
                  setEditingBook({ ...editingBook, title: e.target.value })
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Autor
              </label>
              <input
                type="text"
                value={editingBook.author}
                onChange={(e) =>
                  setEditingBook({ ...editingBook, author: e.target.value })
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Data de publicação
              </label>
              <input
                type="text"
                value={editingBook.publishedDate || ""}
                onChange={(e) =>
                  setEditingBook({
                    ...editingBook,
                    publishedDate: e.target.value || null,
                  })
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Sinopse
              </label>
              <textarea
                value={editingBook.synopsis || ""}
                onChange={(e) =>
                  setEditingBook({
                    ...editingBook,
                    synopsis: e.target.value || null,
                  })
                }
                rows={3}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                URL da capa
              </label>
              <input
                type="text"
                value={editingBook.coverUrl || ""}
                onChange={(e) =>
                  setEditingBook({
                    ...editingBook,
                    coverUrl: e.target.value || null,
                  })
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <button
                type="button"
                onClick={handleSearchCover}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
              >
                {loading ? "Buscando..." : "🔍 Buscar capa automaticamente"}
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Coleção / Estante
              </label>
              <input
                type="text"
                value={editingBook.collection}
                onChange={(e) =>
                  setEditingBook({
                    ...editingBook,
                    collection: e.target.value,
                  })
                }
                placeholder="Ex: Estante da Sala"
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Status
              </label>
              <select
                value={editingBook.status}
                onChange={(e) =>
                  setEditingBook({
                    ...editingBook,
                    status: e.target.value as Book["status"],
                  })
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
              >
                <option value="TO_READ">A ler</option>
                <option value="READ">Lido</option>
                <option value="WISHLIST">Desejo</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Avaliação (1-5)
              </label>
              <select
                value={editingBook.rating || ""}
                onChange={(e) =>
                  setEditingBook({
                    ...editingBook,
                    rating: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
              >
                <option value="">Sem avaliação</option>
                <option value="1">1 estrela</option>
                <option value="2">2 estrelas</option>
                <option value="3">3 estrelas</option>
                <option value="4">4 estrelas</option>
                <option value="5">5 estrelas</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Notas pessoais
              </label>
              <textarea
                value={editingBook.notes || ""}
                onChange={(e) =>
                  setEditingBook({
                    ...editingBook,
                    notes: e.target.value || null,
                  })
                }
                rows={2}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingBook(null)}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
