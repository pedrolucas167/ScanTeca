"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Download,
  Globe,
  GripVertical,
  LayoutGrid,
  Library,
  List,
  PlusCircle,
  Search,
  Share2,
  Star,
} from "lucide-react";

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
  genre: string | null;
  pages: number | null;
  customOrder: number | null;
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

export default function Catalog({
  books,
  libraryName: initialLibraryName,
  shareEnabled: initialShareEnabled,
  shareId: initialShareId,
}: {
  books: Book[];
  libraryName: string;
  shareEnabled: boolean;
  shareId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [collectionFilter, setCollectionFilter] = useState<string>("");
  const [ratingFilter, setRatingFilter] = useState<string>("");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [noCoverOnly, setNoCoverOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "shelf">("grid");
  const [showStats, setShowStats] = useState(false);
  const [sortBy, setSortBy] = useState<
    "title-asc" | "title-desc" | "author-asc" | "author-desc" | "newest" | "oldest" | "rating" | "custom"
  >("newest");
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [bookList, setBookList] = useState<Book[]>(books);
  const [libraryName, setLibraryName] = useState(initialLibraryName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(initialLibraryName);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [shareEnabled, setShareEnabled] = useState(initialShareEnabled);
  const [shareId, setShareId] = useState<string | null>(initialShareId);

  const collections = useMemo(
    () => Array.from(new Set(bookList.map((b) => b.collection))).sort(),
    [bookList]
  );

  const genres = useMemo(
    () =>
      Array.from(
        new Set(bookList.map((b) => b.genre).filter((g): g is string => !!g))
      ).sort(),
    [bookList]
  );

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          bookList
            .map((b) => {
              const match = b.publishedDate?.match(/\d{4}/);
              return match ? match[0] : null;
            })
            .filter((y): y is string => !!y)
        )
      ).sort((a, b) => Number(b) - Number(a)),
    [bookList]
  );

  const stats = useMemo(() => {
    const read = bookList.filter((b) => b.status === "READ");
    const totalPages = read.reduce((sum, b) => sum + (b.pages ?? 0), 0);
    const rated = bookList.filter((b) => b.rating !== null);
    const avgRating =
      rated.length > 0
        ? rated.reduce((sum, b) => sum + (b.rating ?? 0), 0) / rated.length
        : 0;
    return {
      total: bookList.length,
      read: read.length,
      toRead: bookList.filter((b) => b.status === "TO_READ").length,
      wishlist: bookList.filter((b) => b.status === "WISHLIST").length,
      totalPages,
      avgRating: Math.round(avgRating * 10) / 10,
      noCover: bookList.filter((b) => !b.coverUrl).length,
    };
  }, [bookList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = bookList.filter((book) => {
      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.isbn.toLowerCase().includes(q) ||
        (book.genre?.toLowerCase().includes(q) ?? false);
      const matchesStatus = !statusFilter || book.status === statusFilter;
      const matchesCollection =
        !collectionFilter || book.collection === collectionFilter;
      const matchesRating =
        !ratingFilter || book.rating === Number(ratingFilter);
      const matchesYear =
        !yearFilter || (book.publishedDate?.includes(yearFilter) ?? false);
      const matchesGenre = !genreFilter || book.genre === genreFilter;
      const matchesNoCover = !noCoverOnly || !book.coverUrl;
      return (
        matchesQuery &&
        matchesStatus &&
        matchesCollection &&
        matchesRating &&
        matchesYear &&
        matchesGenre &&
        matchesNoCover
      );
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "title-asc":
          return a.title.localeCompare(b.title, "pt-BR");
        case "title-desc":
          return b.title.localeCompare(a.title, "pt-BR");
        case "author-asc":
          return a.author.localeCompare(b.author, "pt-BR");
        case "author-desc":
          return b.author.localeCompare(a.author, "pt-BR");
        case "rating":
          return (b.rating ?? 0) - (a.rating ?? 0);
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "custom":
          return (a.customOrder ?? 999999) - (b.customOrder ?? 999999);
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [bookList, query, statusFilter, collectionFilter, ratingFilter, yearFilter, genreFilter, noCoverOnly, sortBy]);

  const handleEdit = (book: Book) => {
    setEditingBook({ ...book });
  };

  const handleDelete = async (book: Book) => {
    if (!confirm(`Tem certeza que deseja remover "${book.title}"?`)) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/books?id=${book.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        setBookList((prev) => prev.filter((b) => b.id !== book.id));
        setMessage(`${book.title} removido`);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage(data.error || "Erro ao remover");
      }
    } catch {
      setMessage("Erro de rede ao remover");
    } finally {
      setLoading(false);
    }
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
          genre: editingBook.genre,
          pages: editingBook.pages,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setBookList((prev) =>
          prev.map((b) => (b.id === data.book.id ? data.book : b))
        );
        setEditingBook(null);
        setMessage(`${data.book.title} atualizado`);
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
          setMessage(`Capa encontrada para "${book.title}". Confira a pré-visualização no modal de edição.`);
          setTimeout(() => setMessage(null), 5000);
          return data.coverUrl;
        } else {
          setMessage(saveData.error || "Erro ao salvar capa");
        }
      } else {
        setMessage(
          data.error ||
            "Nenhuma capa encontrada automaticamente. Você pode adicionar uma capa manualmente no botão Editar."
        );
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

  const handleSaveLibraryName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const res = await fetch("/api/library-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json();

      if (res.ok) {
        setLibraryName(data.setting.name);
        setIsEditingName(false);
        setMessage("Nome da biblioteca atualizado");
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage(data.error || "Erro ao salvar nome");
      }
    } catch {
      setMessage("Erro de rede ao salvar nome");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchWikipediaCover = async () => {
    if (!editingBook) return;
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/search-cover-wikipedia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingBook.title }),
      });

      const data = await res.json();

      if (res.ok && data.coverUrl) {
        setEditingBook({ ...editingBook, coverUrl: data.coverUrl });

        const saveRes = await fetch("/api/books", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingBook.id,
            coverUrl: data.coverUrl,
          }),
        });

        if (saveRes.ok) {
          setBookList((prev) =>
            prev.map((b) =>
              b.id === editingBook.id ? { ...b, coverUrl: data.coverUrl } : b
            )
          );
          setMessage(`Capa encontrada na Wikipédia para ${editingBook.title}`);
          setTimeout(() => setMessage(null), 3000);
        } else {
          const saveData = await saveRes.json();
          setMessage(saveData.error || "Erro ao salvar capa");
        }
      } else {
        setMessage(data.error || "Nenhuma capa encontrada na Wikipédia");
      }
    } catch {
      setMessage("Erro ao buscar capa na Wikipédia");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchAuthor = async () => {
    if (!editingBook) return;

    if (!editingBook.title.trim()) {
      setMessage("Preencha o título para buscar o autor");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/search-author", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingBook.title,
          isbn: editingBook.isbn,
        }),
      });

      const data = await res.json();

      if (res.ok && data.author) {
        setEditingBook({ ...editingBook, author: data.author });
        setMessage(`Autor encontrado: ${data.author}`);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage(data.error || "Nenhum autor encontrado");
      }
    } catch {
      setMessage("Erro ao buscar autor");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Título",
      "Autor",
      "ISBN",
      "Publicação",
      "Gênero",
      "Status",
      "Coleção",
      "Avaliação",
      "Páginas",
      "Capa",
      "Sinopse",
      "Notas",
    ];

    const escape = (v: string | number | null | undefined) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const rows = filtered.map((b) =>
      [
        escape(b.title),
        escape(b.author),
        escape(b.isbn),
        escape(b.publishedDate),
        escape(b.genre),
        escape(statusLabels[b.status] ?? b.status),
        escape(b.collection),
        escape(b.rating),
        escape(b.pages),
        escape(b.coverUrl),
        escape(b.synopsis),
        escape(b.notes),
      ].join(",")
    );

    const csv = "\uFEFF" + [headers.map(escape).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scanteca-catalogo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Catálogo exportado (${filtered.length} livros)`);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const ids = filtered.map((b) => b.id);
    const fromIndex = ids.indexOf(draggedId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      return;
    }

    const reordered = [...filtered];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Assign customOrder based on new positions
    const updated = reordered.map((b, i) => ({ ...b, customOrder: i }));
    setBookList((prev) =>
      prev.map((b) => updated.find((u) => u.id === b.id) ?? b)
    );
    setSortBy("custom");
    setDraggedId(null);

    // Persist order
    try {
      await Promise.all(
        updated.map((b) =>
          fetch("/api/books", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: b.id, customOrder: b.customOrder }),
          })
        )
      );
      setMessage("Ordem personalizada salva");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("Erro ao salvar ordem");
    }
  };

  const handleToggleShare = async () => {
    const newValue = !shareEnabled;
    setLoading(true);
    try {
      const res = await fetch("/api/library-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareEnabled: newValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setShareEnabled(data.setting.shareEnabled);
        setShareId(data.setting.shareId);
        if (data.setting.shareEnabled && data.setting.shareId) {
          const url = `${window.location.origin}/shared/${data.setting.shareId}`;
          await navigator.clipboard.writeText(url).catch(() => {});
          setMessage(`Link público ativado e copiado: ${url}`);
        } else {
          setMessage("Link público desativado");
        }
        setTimeout(() => setMessage(null), 6000);
      } else {
        setMessage(data.error || "Erro ao atualizar compartilhamento");
      }
    } catch {
      setMessage("Erro de rede");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-zinc-200 bg-gradient-to-br from-indigo-50 to-white px-4 py-12 text-center dark:border-zinc-800 dark:from-indigo-950/20 dark:to-zinc-950">
        <h1 className="flex items-center justify-center gap-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          <BookOpen className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          Scanteca
        </h1>

        <div className="mx-auto mt-4 flex max-w-lg flex-col items-center justify-center gap-2 sm:flex-row">
          {isEditingName ? (
            <div className="flex w-full items-center justify-center gap-2 sm:w-auto">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveLibraryName();
                  if (e.key === "Escape") {
                    setIsEditingName(false);
                    setNameInput(libraryName);
                  }
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-center text-lg font-semibold text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-64 dark:border-zinc-600 dark:bg-zinc-800"
                autoFocus
              />
              <button
                onClick={handleSaveLibraryName}
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-70"
              >
                Salvar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="group flex items-center gap-2 rounded-lg border border-transparent px-3 py-1 text-lg font-semibold text-foreground hover:border-zinc-200 hover:bg-white/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
            >
              {libraryName}
              <span className="text-xs font-normal text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-500">
                (editar)
              </span>
            </button>
          )}
          <span className="hidden text-zinc-300 dark:text-zinc-700 sm:inline">
            ·
          </span>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {bookList.length} {bookList.length === 1 ? "livro" : "livros"}
          </p>
        </div>

        <p className="mx-auto mt-3 max-w-lg text-zinc-600 dark:text-zinc-400">
          Organize seus livros: lidos, a ler e lista de desejos.
        </p>
        <div className="mx-auto mt-6 flex max-w-2xl flex-col gap-3 sm:flex-row sm:justify-center">
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
            Escanear
          </Link>
          <Link
            href="/search-add"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-300 bg-indigo-50 px-6 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
          >
            <Search className="h-4 w-4" />
            Buscar Livro
          </Link>
          <Link
            href="/manual-add"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <PlusCircle className="h-4 w-4" />
            Adicionar Manual
          </Link>
        </div>
      </section>

      <section className="flex-1 px-4 py-8">
        <div className="mx-auto mb-6 max-w-6xl space-y-3">
          {/* Toolbar: stats, export, view mode */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowStats((s) => !s)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  showStats
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                    : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Estatísticas
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={handleToggleShare}
                disabled={loading}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  shareEnabled
                    ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                <Share2 className="h-3.5 w-3.5" />
                {shareEnabled ? "Link ativo" : "Compartilhar"}
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white p-1 dark:border-zinc-600 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grade"
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "grid"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                    : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="Lista compacta"
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "list"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                    : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("shelf")}
                title="Estante"
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "shelf"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                    : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                <Library className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Stats panel */}
          {showStats && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {stats.total}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.read}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Lidos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.toRead}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">A ler</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.wishlist}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Desejos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.totalPages.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Páginas lidas
                </p>
              </div>
              <div className="text-center">
                <p className="flex items-center justify-center gap-1 text-2xl font-bold text-yellow-500">
                  {stats.avgRating}
                  <Star className="h-4 w-4 fill-current" />
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Média de avaliação
                </p>
              </div>
            </div>
          )}

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, autor, ISBN ou gênero..."
            className="w-full rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm text-foreground placeholder-zinc-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value="">Todos os status</option>
              <option value="READ">Lidos</option>
              <option value="TO_READ">A ler</option>
              <option value="WISHLIST">Desejos</option>
            </select>
            <select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value="">Todas as coleções</option>
              {collections.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value="">Todos os gêneros</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value="">Todos os anos</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value="">Todas as avaliações</option>
              <option value="5">5 estrelas</option>
              <option value="4">4 estrelas</option>
              <option value="3">3 estrelas</option>
              <option value="2">2 estrelas</option>
              <option value="1">1 estrela</option>
            </select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Ordenar:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
                >
                  <option value="newest">Mais recentes</option>
                  <option value="oldest">Mais antigos</option>
                  <option value="title-asc">Título (A-Z)</option>
                  <option value="title-desc">Título (Z-A)</option>
                  <option value="author-asc">Autor (A-Z)</option>
                  <option value="author-desc">Autor (Z-A)</option>
                  <option value="rating">Melhor avaliados</option>
                  <option value="custom">Ordem personalizada</option>
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={noCoverOnly}
                  onChange={(e) => setNoCoverOnly(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
                />
                Somente sem capa
              </label>
              {sortBy === "custom" && (
                <span className="text-xs text-indigo-600 dark:text-indigo-400">
                  Arraste os cards para reordenar
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {filtered.length} {filtered.length === 1 ? "livro" : "livros"}
            </p>
          </div>
        </div>

        {message && (
          <div className="mx-auto mb-6 max-w-6xl rounded-lg bg-green-100 p-3 text-sm font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
            {message}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="mb-4 h-16 w-16 text-zinc-300 dark:text-zinc-700" />
            <h2 className="text-xl font-semibold text-foreground">
              {query || statusFilter || collectionFilter || ratingFilter || yearFilter || genreFilter || noCoverOnly
                ? "Nenhum livro encontrado"
                : "Nenhum livro cadastrado"}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              {query || statusFilter || collectionFilter || ratingFilter || yearFilter || genreFilter || noCoverOnly
                ? "Tente ajustar os filtros."
                : "Use o scanner ou adicione manualmente livros ao seu catálogo."}
            </p>
          </div>
        ) : viewMode === "list" ? (
          /* ===== LIST VIEW ===== */
          <div className="mx-auto max-w-6xl divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {filtered.map((book) => (
              <div
                key={book.id}
                draggable={sortBy === "custom"}
                onDragStart={() => handleDragStart(book.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(book.id)}
                onClick={() => (window.location.href = `/books/${book.id}`)}
                className={`group flex cursor-pointer items-center gap-4 p-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                  draggedId === book.id ? "opacity-50" : ""
                }`}
              >
                {sortBy === "custom" && (
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-400" />
                )}
                <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                  {book.coverUrl ? (
                    <Image
                      src={book.coverUrl}
                      alt={`Capa de ${book.title}`}
                      fill
                      className="object-cover"
                      sizes="44px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-400">
                      <BookOpen className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {book.title}
                  </h3>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {book.author}
                    {book.publishedDate ? ` · ${book.publishedDate}` : ""}
                    {book.genre ? ` · ${book.genre}` : ""}
                  </p>
                </div>
                <span
                  className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline ${statusClasses[book.status]}`}
                >
                  {statusLabels[book.status]}
                </span>
                {book.rating ? (
                  <span className="hidden shrink-0 items-center gap-0.5 text-xs text-yellow-500 sm:flex">
                    <Star className="h-3 w-3 fill-current" />
                    {book.rating}
                  </span>
                ) : null}
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(book);
                    }}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  >
                    Editar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(book);
                    }}
                    className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "shelf" ? (
          /* ===== SHELF VIEW ===== */
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {filtered.map((book) => (
                <div
                  key={book.id}
                  draggable={sortBy === "custom"}
                  onDragStart={() => handleDragStart(book.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(book.id)}
                  onClick={() => (window.location.href = `/books/${book.id}`)}
                  className={`group relative cursor-pointer ${
                    draggedId === book.id ? "opacity-50" : ""
                  }`}
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-zinc-100 shadow-md transition-transform group-hover:-translate-y-1 group-hover:shadow-xl dark:bg-zinc-800">
                    {book.coverUrl ? (
                      <Image
                        src={book.coverUrl}
                        alt={`Capa de ${book.title}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center p-2 text-center text-zinc-400">
                        <BookOpen className="mb-1 h-8 w-8" />
                        <span className="line-clamp-3 text-[10px] font-medium">
                          {book.title}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="line-clamp-1 text-[10px] font-medium text-white">
                        {book.title}
                      </p>
                      <p className="line-clamp-1 text-[9px] text-zinc-300">
                        {book.author}
                      </p>
                    </div>
                  </div>
                  {/* shelf line */}
                  <div className="mx-1 mt-1 h-1.5 rounded-b-sm bg-amber-900/20 dark:bg-amber-100/10" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ===== GRID VIEW ===== */
          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((book) => (
              <article
                key={book.id}
                draggable={sortBy === "custom"}
                onDragStart={() => handleDragStart(book.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(book.id)}
                onClick={() => (window.location.href = `/books/${book.id}`)}
                className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 ${
                  draggedId === book.id ? "opacity-50" : ""
                }`}
              >
                {sortBy === "custom" && (
                  <div className="absolute left-2 top-2 z-10 rounded bg-black/50 p-1 text-white">
                    <GripVertical className="h-4 w-4 cursor-grab" />
                  </div>
                )}
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
                      <span className="mt-1 text-xs">Sem capa disponível</span>
                      <p className="mt-1 max-w-[180px] text-center text-[10px] text-zinc-400 dark:text-zinc-500">
                        Nenhuma capa encontrada na internet. Clique em Editar para adicionar manualmente.
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          searchAndSaveCover(book);
                        }}
                        disabled={loading}
                        className="mt-2 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {loading ? "Buscando..." : <span className="flex items-center gap-1"><Search className="h-3 w-3" /> Buscar capa</span>}
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
                      <span className="flex items-center gap-0.5 text-xs text-yellow-500">
                        {Array.from({ length: book.rating }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-current" />
                        ))}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
                    {book.title}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {book.author}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400 dark:text-zinc-500">
                    {book.publishedDate && <span>{book.publishedDate}</span>}
                    {book.genre && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">
                        {book.genre}
                      </span>
                    )}
                    {book.pages && <span>{book.pages} págs</span>}
                  </div>
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
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(book);
                        }}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      >
                        Editar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(book);
                        }}
                        className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        Remover
                      </button>
                    </div>
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
              <button
                type="button"
                onClick={handleSearchAuthor}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {loading ? "Buscando..." : "Buscar autor"}
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
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
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Páginas
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingBook.pages ?? ""}
                  onChange={(e) =>
                    setEditingBook({
                      ...editingBook,
                      pages: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Ex: 320"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Gênero
              </label>
              <input
                type="text"
                value={editingBook.genre || ""}
                onChange={(e) =>
                  setEditingBook({
                    ...editingBook,
                    genre: e.target.value || null,
                  })
                }
                placeholder="Ex: Ficção, Romance, Fantasia..."
                list="genre-suggestions"
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <datalist id="genre-suggestions">
                {genres.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
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
                {loading ? "Buscando..." : <span className="flex items-center justify-center gap-2"><Search className="h-4 w-4" /> Buscar capa automaticamente</span>}
              </button>

              <button
                type="button"
                onClick={handleSearchWikipediaCover}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {loading ? "Buscando..." : <span className="flex items-center justify-center gap-2"><Globe className="h-4 w-4" /> Buscar capa na Wikipédia</span>}
              </button>

              {editingBook.coverUrl && (
                <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Pré-visualização da capa
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editingBook.coverUrl}
                    alt={`Capa de ${editingBook.title}`}
                    className="h-48 w-auto rounded-md object-contain shadow-sm"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}
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
