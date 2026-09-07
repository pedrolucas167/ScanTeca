"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publishedDate: string | null;
  synopsis: string | null;
  coverUrl: string | null;
  status: "READ" | "READING" | "TO_READ" | "WISHLIST";
  currentPage: number | null;
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
  READING: "Lendo",
  TO_READ: "A ler",
  WISHLIST: "Desejo",
};

const statusClasses: Record<string, string> = {
  READ: "bg-primary-container text-on-primary-container",
  READING: "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40",
  TO_READ: "bg-amber-950/80 text-amber-300 border border-amber-500/40",
  WISHLIST: "bg-secondary-container/30 text-secondary",
};

const isKnownAuthor = (author: string | null | undefined) => {
  if (!author) return false;
  const a = author.trim().toLowerCase();
  return (
    a.length > 0 &&
    a !== "autor desconhecido" &&
    a !== "[author not identified]"
  );
};

const literaryQuotes = [
  { text: "Sempre imaginei que o paraíso fosse uma espécie de biblioteca.", author: "Jorge Luis Borges" },
  { text: "Um quarto sem livros é como um corpo sem alma.", author: "Cícero" },
  { text: "A leitura de todos os bons livros é uma conversação com as mais honestas pessoas dos séculos passados.", author: "Descartes" },
  { text: "Há livros escritos para evitar espaços vazios na estante.", author: "Carlos Drummond de Andrade" },
  { text: "Um leitor vive mil vidas antes de morrer. O homem que nunca lê vive apenas uma.", author: "George R. R. Martin" },
  { text: "A vida é a arte do encontro, embora haja tanto desencontro pela vida.", author: "Vinicius de Moraes" },
  { text: "Ler é sonhar acordado.", author: "Anônimo" },
  { text: "Os livros são os mais quietos e constantes dos amigos.", author: "Charles W. Eliot" },
];

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

function QuickFilterChip({
  label,
  count,
  active,
  onClick,
  dotColor,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  dotColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-space-md py-1.5 font-label-sm text-label-sm transition-colors ${
        active
          ? "border-transparent bg-primary text-on-primary shadow-[0_0_12px_rgba(196,192,255,0.3)]"
          : "border-white/5 bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
      }`}
    >
      {dotColor && <span className={`h-2 w-2 rounded-full ${dotColor}`} />}
      <span>{label}</span>
      {count !== undefined && <span className="font-caption text-caption text-outline">{count}</span>}
    </button>
  );
}

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
  const [viewMode, setViewMode] = useState<"physical-shelf" | "physical-stack" | "list" | "grid">("physical-shelf");
  const router = useRouter();
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
  const [copied, setCopied] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [now] = useState(() => Date.now());

  const quote = literaryQuotes[
    Math.floor(now / (1000 * 60 * 60 * 24)) % literaryQuotes.length
  ];

  const activeFiltersCount =
    [statusFilter, collectionFilter, genreFilter, yearFilter, ratingFilter].filter(Boolean).length +
    (noCoverOnly ? 1 : 0);

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
    const allPages = bookList.reduce((sum, b) => sum + (b.pages ?? 0), 0);
    const rated = bookList.filter((b) => b.rating !== null);
    const avgRating =
      rated.length > 0
        ? rated.reduce((sum, b) => sum + (b.rating ?? 0), 0) / rated.length
        : 0;

    const stackMeters = Math.round(allPages * 0.08) / 1000;
    const readingHours = Math.round(allPages / 40);

    const authorCount = new Map<string, number>();
    for (const b of bookList) {
      if (isKnownAuthor(b.author)) {
        const author = b.author.trim();
        authorCount.set(author, (authorCount.get(author) ?? 0) + 1);
      }
    }
    const topAuthor =
      authorCount.size > 0
        ? [...authorCount.entries()].sort((a, b) => b[1] - a[1])[0]
        : null;

    const oldest = bookList
      .map((b) => {
        const m = b.publishedDate?.match(/\d{4}/);
        return m ? { title: b.title, year: Number(m[0]) } : null;
      })
      .filter((x): x is { title: string; year: number } => !!x)
      .sort((a, b) => a.year - b.year)[0] ?? null;

    const readDates = read
      .map((b) => new Date(b.createdAt).getTime())
      .sort((a, b) => a - b);
    const monthsSpan =
      readDates.length > 1
        ? Math.max(1, (now - readDates[0]) / (1000 * 60 * 60 * 24 * 30))
        : 1;
    const pace = Math.round((read.length / monthsSpan) * 10) / 10;

    return {
      total: bookList.length,
      read: read.length,
      reading: bookList.filter((b) => b.status === "READING").length,
      toRead: bookList.filter((b) => b.status === "TO_READ").length,
      wishlist: bookList.filter((b) => b.status === "WISHLIST").length,
      totalPages,
      allPages,
      avgRating: Math.round(avgRating * 10) / 10,
      noCover: bookList.filter((b) => !b.coverUrl).length,
      stackMeters,
      readingHours,
      topAuthor,
      oldest,
      pace,
    };
  }, [bookList, now]);

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
      const matchesCollection = !collectionFilter || book.collection === collectionFilter;
      const matchesRating = !ratingFilter || book.rating === Number(ratingFilter);
      const matchesYear = !yearFilter || (book.publishedDate?.includes(yearFilter) ?? false);
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

  const handleEdit = (book: Book) => setEditingBook({ ...book });

  const handleDelete = async (book: Book) => {
    if (!confirm(`Tem certeza que deseja remover "${book.title}"?`)) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/books?id=${book.id}`, { method: "DELETE" });
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
          currentPage: editingBook.currentPage,
          collection: editingBook.collection,
          notes: editingBook.notes,
          rating: editingBook.rating,
          genre: editingBook.genre,
          pages: editingBook.pages,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBookList((prev) => prev.map((b) => (b.id === data.book.id ? data.book : b)));
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
          body: JSON.stringify({ id: book.id, coverUrl: data.coverUrl }),
        });
        const saveData = await saveRes.json();
        if (saveRes.ok) {
          setBookList((prev) =>
            prev.map((b) => (b.id === book.id ? { ...b, coverUrl: data.coverUrl } : b))
          );
          setMessage(`Capa encontrada para "${book.title}".`);
          setTimeout(() => setMessage(null), 5000);
          return data.coverUrl;
        } else {
          setMessage(saveData.error || "Erro ao salvar capa");
        }
      } else {
        setMessage(data.error || "Nenhuma capa encontrada automaticamente.");
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
    if (coverUrl && editingBook) setEditingBook({ ...editingBook, coverUrl });
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
        const oldName = libraryName;
        setLibraryName(data.setting.name);
        setBookList((prev) =>
          prev.map((b) =>
            b.collection === oldName ? { ...b, collection: data.setting.name } : b
          )
        );
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
          body: JSON.stringify({ id: editingBook.id, coverUrl: data.coverUrl }),
        });
        if (saveRes.ok) {
          setBookList((prev) =>
            prev.map((b) => (b.id === editingBook.id ? { ...b, coverUrl: data.coverUrl } : b))
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
        body: JSON.stringify({ title: editingBook.title, isbn: editingBook.isbn }),
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

  const handleGenerateSynopsis = async () => {
    if (!editingBook) return;
    if (!editingBook.title.trim()) {
      setMessage("Preencha o título para gerar a sinopse");
      return;
    }
    const hasSynopsis = editingBook.synopsis && editingBook.synopsis.trim().length > 0;
    if (hasSynopsis && !window.confirm("Já existe uma sinopse. Deseja substituí-la por uma nova?")) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/generate-synopsis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingBook.title,
          author: editingBook.author,
          isbn: editingBook.isbn,
          force: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.synopsis) {
        setEditingBook({ ...editingBook, synopsis: data.synopsis });
        setMessage("Sinopse gerada! Revise antes de salvar.");
        setTimeout(() => setMessage(null), 4000);
      } else if (res.ok) {
        setMessage(data.error || "Não foi possível encontrar uma sinopse");
      } else {
        setMessage(data.error || "Erro ao gerar sinopse");
      }
    } catch {
      setMessage("Erro de rede ao gerar sinopse");
    } finally {
      setLoading(false);
    }
  };

  const handleEnrichAll = async () => {
    if (!window.confirm("Buscar e preencher automaticamente sinopse, gênero e páginas dos livros que estão sem esses dados?")) {
      return;
    }
    setEnriching(true);
    setMessage(null);
    try {
      const res = await fetch("/api/books/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(
          data.enriched > 0
            ? `${data.enriched} de ${data.total} livro(s) atualizados. Recarregando...`
            : "Nenhum dado novo encontrado para os livros pendentes."
        );
        if (data.enriched > 0) {
          setTimeout(() => window.location.reload(), 2000);
        } else {
          setTimeout(() => setMessage(null), 5000);
        }
      } else {
        setMessage(data.error || "Erro ao enriquecer acervo");
      }
    } catch {
      setMessage("Erro de rede ao enriquecer acervo");
    } finally {
      setEnriching(false);
    }
  };

  const handleEnrichBook = async () => {
    if (!editingBook) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/books/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: editingBook.id }),
      });
      const data = await res.json();
      const values = data?.results?.[0]?.values as
        | { synopsis?: string; genre?: string; pages?: number }
        | undefined;
      if (res.ok && values && Object.keys(values).length > 0) {
        setEditingBook({
          ...editingBook,
          synopsis: values.synopsis ?? editingBook.synopsis,
          genre: values.genre ?? editingBook.genre,
          pages: values.pages ?? editingBook.pages,
        });
        const fields = Object.keys(values)
          .map((f) => (f === "synopsis" ? "sinopse" : f === "genre" ? "gênero" : "páginas"))
          .join(", ");
        setMessage(`Dados preenchidos: ${fields}. Revise antes de salvar.`);
        setTimeout(() => setMessage(null), 5000);
      } else if (res.ok) {
        setMessage("Nenhum dado novo encontrado para este livro");
        setTimeout(() => setMessage(null), 4000);
      } else {
        setMessage(data.error || "Erro ao completar dados");
      }
    } catch {
      setMessage("Erro de rede ao completar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Título", "Autor", "ISBN", "Publicação", "Gênero", "Status", "Coleção",
      "Avaliação", "Páginas", "Capa", "Sinopse", "Notas",
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

  const handleDragStart = (id: string) => setDraggedId(id);

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
    const updated = reordered.map((b, i) => ({ ...b, customOrder: i }));
    setBookList((prev) => prev.map((b) => updated.find((u) => u.id === b.id) ?? b));
    setSortBy("custom");
    setDraggedId(null);
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
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          setMessage("Link público ativado e copiado!");
        } else {
          setMessage("Link público desativado");
        }
        setTimeout(() => setMessage(null), 4000);
      } else {
        setMessage(data.error || "Erro ao atualizar compartilhamento");
      }
    } catch {
      setMessage("Erro de rede");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareId) return;
    const url = `${window.location.origin}/shared/${shareId}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const spineCm = (pages: number | null) => {
    if (!pages || pages <= 0) return 1.0;
    return Math.max(0.8, Math.round((pages * 0.08) * 10) / 10);
  };

  const metricEquivalent = (meters: number) => {
    if (meters < 0.3) return "pasta de papéis";
    if (meters < 1.0) return "tornozelo";
    if (meters < 1.5) return "cachorro pequeno";
    if (meters < 2.5) return "criança em pé";
    if (meters < 4.0) return "porta";
    return "girafa adulta";
  };

  const shelfBooks = filtered.slice(0, 10);
  const stackBooks = filtered
    .filter((b) => b.status === "READING" || b.status === "TO_READ")
    .slice(0, 6);

  return (
    <div className="relative flex min-h-screen flex-col bg-surface pb-24 text-on-surface">
      <header className="sticky top-0 z-40 border-b border-outline-variant/20 bg-surface/80 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-space-xs">
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-primary transition-colors hover:bg-surface-container-highest hover:text-on-surface active:scale-95">
              <Icon name="local_library" className="text-[22px]" />
            </button>
            <div className="flex flex-col">
              <div className="flex cursor-pointer items-center gap-1">
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
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
                      className="w-40 rounded-md border border-outline-variant/40 bg-surface-container px-2 py-0.5 font-headline-lg-mobile text-headline-lg-mobile tracking-tight text-on-surface focus:border-primary focus:outline-none sm:w-56"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveLibraryName}
                      disabled={loading}
                      className="rounded-md bg-primary-container px-2 py-0.5 text-[10px] font-semibold text-on-primary-container"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      onClick={() => setIsEditingName(true)}
                      className="font-headline-lg-mobile text-headline-lg-mobile font-bold tracking-tight text-on-surface transition-colors hover:text-primary"
                    >
                      {libraryName}
                    </span>
                    <Icon name="expand_more" className="text-sm text-outline" />
                  </>
                )}
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-primary-container" />
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Sala de Leitura • {stats.total} {stats.total === 1 ? "volume" : "volumes"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-space-xs">
            <Link
              href="/oracle"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-primary transition-colors hover:bg-surface-container-highest hover:text-on-surface"
            >
              <Icon name="psychology" className="text-[22px]" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(204,190,255,0.8)]" />
            </Link>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                showFilters || activeFiltersCount > 0
                  ? "bg-primary-container/20 text-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
              }`}
            >
              <Icon name="tune" className="text-[22px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-4">
        {/* Metric widget */}
        <section className="relative overflow-hidden rounded-lg border border-white/5 bg-surface-container-low p-space-lg shadow-sm">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary-container/15 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <Icon name="straighten" className="text-tertiary" />
                <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                  Dimensão Física Acumulada
                </span>
              </div>
              <span className="rounded-full bg-surface-container-highest px-2 py-0.5 font-caption text-caption text-primary">
                RAG Vectorizado
              </span>
            </div>
            <div className="flex items-baseline gap-space-xs">
              <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">
                {stats.stackMeters.toFixed(2).replace(".", ",")}
              </h1>
              <span className="font-headline-md text-headline-md font-serif text-primary">metros</span>
            </div>
            <div className="inline-flex w-fit items-center gap-space-xs rounded-full border border-white/10 bg-surface-container px-space-md py-space-xs">
              <Icon name="height" className="text-body-md text-tertiary" />
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Equivalente à altura de uma{" "}
                <strong className="font-medium text-tertiary">{metricEquivalent(stats.stackMeters)}</strong>{" "}
                em livros impressos
              </span>
            </div>
            <div className="grid grid-cols-3 gap-space-xs pt-space-xs">
              <div className="flex flex-col rounded border border-white/5 bg-surface-container/60 p-space-sm">
                <span className="font-caption text-caption text-outline">Acervo Total</span>
                <span className="mt-0.5 font-headline-md text-headline-md font-semibold text-on-surface">{stats.total}</span>
                <span className="font-caption text-caption text-on-surface-variant">volumes catalogados</span>
              </div>
              <div className="flex flex-col rounded border border-white/5 bg-surface-container/60 p-space-sm">
                <span className="font-caption text-caption text-outline">Lombada Média</span>
                <span className="mt-0.5 font-headline-md text-headline-md font-semibold text-primary">
                  {stats.total > 0 ? (stats.stackMeters * 100 / stats.total).toFixed(1).replace(".", ",") : "0,0"}{" "}
                  <span className="font-caption text-caption">cm</span>
                </span>
                <span className="font-caption text-caption text-on-surface-variant">espessura física</span>
              </div>
              <div className="flex flex-col rounded border border-white/5 bg-surface-container/60 p-space-sm">
                <span className="font-caption text-caption text-outline">Em {new Date().getFullYear()}</span>
                <span className="mt-0.5 font-headline-md text-headline-md font-semibold text-secondary">{stats.read}</span>
                <span className="font-caption text-caption text-on-surface-variant">obras concluídas</span>
              </div>
            </div>
          </div>
        </section>

        {/* View switcher + filters */}
        <section className="space-y-space-sm">
          <div className="flex items-center justify-between rounded-full border border-white/5 bg-surface-container-low p-1">
            {[
              { key: "physical-shelf", icon: "shelves", label: "Prateleiras" },
              { key: "physical-stack", icon: "view_day", label: "Pilha" },
              { key: "list", icon: "view_list", label: "Lista" },
              { key: "grid", icon: "grid_view", label: "Grade" },
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key as typeof viewMode)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-space-xs px-space-sm font-label-md text-label-md transition-all ${
                  viewMode === v.key
                    ? "bg-primary-container text-on-primary-container shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Icon name={v.icon} className="text-body-md" fill={viewMode === v.key} />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
            <QuickFilterChip
              label="Todos"
              count={stats.total}
              active={!statusFilter && !genreFilter}
              onClick={() => { setStatusFilter(""); setGenreFilter(""); }}
            />
            <QuickFilterChip
              label="Lendo"
              count={stats.reading}
              active={statusFilter === "READING"}
              onClick={() => setStatusFilter(statusFilter === "READING" ? "" : "READING")}
              dotColor="bg-emerald-400"
            />
            <QuickFilterChip
              label="Na Fila"
              count={stats.toRead}
              active={statusFilter === "TO_READ"}
              onClick={() => setStatusFilter(statusFilter === "TO_READ" ? "" : "TO_READ")}
              dotColor="bg-amber-400"
            />
            {genres.slice(0, 4).map((g) => (
              <QuickFilterChip
                key={g}
                label={g}
                count={bookList.filter((b) => b.genre === g).length}
                active={genreFilter === g}
                onClick={() => setGenreFilter(genreFilter === g ? "" : g)}
              />
            ))}
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, autor, ISBN ou gênero..."
            className="w-full rounded-full border border-outline-variant/40 bg-surface-container px-5 py-2.5 font-body-sm text-body-sm text-on-surface placeholder:text-outline/70 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </section>

        {showFilters && (
          <section className="grid grid-cols-1 gap-3 rounded-xl border border-outline-variant/20 bg-surface-container p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos os status</option>
              <option value="READ">Lidos</option>
              <option value="READING">Lendo</option>
              <option value="TO_READ">A ler</option>
              <option value="WISHLIST">Desejos</option>
            </select>
            <select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todas as coleções</option>
              {collections.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos os gêneros</option>
              {genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos os anos</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todas as avaliações</option>
              {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} estrelas</option>)}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
            <label className="flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={noCoverOnly}
                onChange={(e) => setNoCoverOnly(e.target.checked)}
                className="h-4 w-4 rounded border-outline-variant bg-surface-container text-primary focus:ring-primary"
              />
              Somente sem capa
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowStats((s) => !s)}
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high"
              >
                <Icon name="bar_chart" className="text-sm" />
                Estatísticas
              </button>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high"
              >
                <Icon name="download" className="text-sm" />
                CSV
              </button>
              <button
                onClick={handleToggleShare}
                disabled={loading}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  shareEnabled
                    ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                    : "border-outline-variant/30 bg-surface-container text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <Icon name="share" className="text-sm" />
                {shareEnabled ? "Link ativo" : "Compartilhar"}
              </button>
              <button
                onClick={handleEnrichAll}
                disabled={enriching}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs font-medium text-amber-300 transition-colors disabled:opacity-60"
              >
                <Icon name="auto_fix_high" className="text-sm" />
                {enriching ? "Enriquecendo..." : "Completar dados"}
              </button>
            </div>
          </section>
        )}

        {message && (
          <div className="rounded-lg bg-emerald-950/40 p-3 text-sm font-medium text-emerald-300">{message}</div>
        )}

        {shareEnabled && shareId && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-2.5">
            <Icon name="share" className="text-sm text-emerald-400" />
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-emerald-300">
              {typeof window !== "undefined" ? `${window.location.origin}/shared/${shareId}` : `/shared/${shareId}`}
            </span>
            <button
              onClick={handleCopyLink}
              className="shrink-0 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        )}

        {showStats && (
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container p-5 shadow-sm">
            <p className="mb-4 text-center font-quote-md text-quote-md italic text-on-surface-variant">— Ficha da coleção —</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Volumes", value: stats.total },
                { label: "Lidos", value: stats.read },
                { label: "Lendo", value: stats.reading },
                { label: "Páginas lidas", value: stats.totalPages.toLocaleString("pt-BR") },
                { label: "Pilha de livros", value: `${stats.stackMeters}m` },
                { label: "Horas de leitura", value: `${stats.readingHours}h` },
                { label: "Média de avaliação", value: stats.avgRating },
                { label: "Ritmo de leitura", value: `${stats.pace}/mês` },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="font-headline-md text-headline-md font-semibold text-primary">{s.value}</p>
                  <p className="text-xs text-on-surface-variant">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-outline-variant/20 pt-4 sm:grid-cols-3">
              {stats.topAuthor && (
                <div className="text-center">
                  <p className="font-quote-md text-quote-md italic text-on-surface">{stats.topAuthor[0]}</p>
                  <p className="text-[10px] uppercase tracking-wider text-outline">Autor mais presente · {stats.topAuthor[1]} obras</p>
                </div>
              )}
              {stats.oldest && (
                <div className="text-center">
                  <p className="font-quote-md text-quote-md italic text-on-surface">{stats.oldest.title} ({stats.oldest.year})</p>
                  <p className="text-[10px] uppercase tracking-wider text-outline">Obra mais antiga</p>
                </div>
              )}
              <div className="text-center">
                <p className="font-quote-md text-quote-md italic text-on-surface">{stats.wishlist}</p>
                <p className="text-[10px] uppercase tracking-wider text-outline">Na lista de desejos</p>
              </div>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Icon name="menu_book" className="mb-4 text-6xl text-outline/30" />
            <h2 className="text-xl font-semibold text-on-surface">
              {query || statusFilter || collectionFilter || ratingFilter || yearFilter || genreFilter || noCoverOnly
                ? "Nenhum livro encontrado"
                : "Nenhum livro cadastrado"}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-on-surface-variant">
              {query || statusFilter || collectionFilter || ratingFilter || yearFilter || genreFilter || noCoverOnly
                ? "Tente ajustar os filtros."
                : "Use o scanner ou adicione manualmente livros ao seu catálogo."}
            </p>
          </div>
        ) : viewMode === "physical-shelf" ? (
          <section className="space-y-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-space-xs">
                <h2 className="font-headline-md text-headline-md font-semibold tracking-tight text-on-surface">
                  Prateleira do Momento
                </h2>
                <span className="font-body-sm text-body-sm font-medium text-on-surface-variant">
                  {shelfBooks.length} volumes
                </span>
              </div>
              <span className="flex items-center font-label-sm text-label-sm text-primary">
                Nível 1,20m <Icon name="chevron_right" className="ml-0.5 text-sm" />
              </span>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-white/5 bg-surface-container-lowest/80 p-space-md pb-0">
              <div className="pointer-events-none absolute left-1/2 top-0 h-16 w-3/4 -translate-x-1/2 bg-gradient-to-b from-primary/10 to-transparent blur-xl" />
              <div className="flex min-h-[220px] items-end gap-4 overflow-x-auto px-2 pb-3 no-scrollbar">
                {shelfBooks.map((book) => {
                  const cm = spineCm(book.pages);
                  const width = Math.max(64, 60 + cm * 14);
                  const height = 160 + Math.min(40, (book.pages ?? 200) / 15);
                  return (
                    <Link
                      key={book.id}
                      href={`/books/${book.id}`}
                      className="group flex flex-shrink-0 flex-col items-center"
                      style={{ width }}
                    >
                      <div
                        className="relative w-full overflow-hidden rounded-t-sm border border-outline-variant/30 bg-surface-container-high book-spine-tangible transition-transform duration-200 group-hover:-translate-y-2"
                        style={{ height }}
                      >
                        {book.coverUrl ? (
                          <Image
                            src={book.coverUrl}
                            alt={`Capa de ${book.title}`}
                            fill
                            className="object-cover"
                            sizes="120px"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-outline">
                            <Icon name="menu_book" className="text-2xl" />
                            <span className="mt-1 line-clamp-3 text-[9px] font-medium">{book.title}</span>
                          </div>
                        )}
                        <span
                          className={`absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold shadow-sm ${statusClasses[book.status]}`}
                        >
                          {statusLabels[book.status]}
                        </span>
                      </div>
                      <div className="mt-2 w-full text-center">
                        <p className="truncate font-label-sm text-label-sm font-medium text-on-surface">{book.title}</p>
                        <p className="truncate font-caption text-[10px] text-outline">
                          {book.author.split(" ").pop() || book.author} • {cm.toFixed(1).replace(".", ",")}cm
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="wood-shelf-gradient relative z-20 h-4 w-full rounded-sm border-t border-white/10" />
              <div className="h-2 w-full bg-surface-container-lowest shadow-inner" />
            </div>
          </section>
        ) : viewMode === "physical-stack" ? (
          <section className="space-y-space-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-headline-md text-headline-md font-semibold tracking-tight text-on-surface">
                  Pilha Física da Semana
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Lombadas tangíveis empilhadas na mesa de cabeceira
                </p>
              </div>
              <div className="text-right">
                <span className="font-headline-md text-headline-md font-serif font-bold text-primary">
                  {stackBooks.reduce((sum, b) => sum + spineCm(b.pages), 0).toFixed(1).replace(".", ",")} cm
                </span>
                <p className="font-caption text-caption text-outline">altura total</p>
              </div>
            </div>
            <div className="relative flex items-center gap-space-md rounded-lg border border-white/5 bg-surface-container-low p-space-lg">
              <div className="metric-ruler-tick flex h-64 w-12 flex-col items-end justify-between border-r border-outline-variant/40 py-2 pr-2 select-none">
                <div className="flex items-center gap-1">
                  <span className="font-caption text-[11px] font-mono font-bold text-primary">10cm</span>
                  <div className="h-0.5 w-3 bg-primary" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-caption text-[10px] font-mono text-outline">7,5cm</span>
                  <div className="h-0.5 w-2 bg-outline" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-caption text-[10px] font-mono text-outline">5,0cm</span>
                  <div className="h-0.5 w-2.5 bg-outline" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-caption text-[10px] font-mono text-outline">2,5cm</span>
                  <div className="h-0.5 w-2 bg-outline" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-caption text-[11px] font-mono font-bold text-outline-variant">0cm</span>
                  <div className="h-0.5 w-3 bg-outline" />
                </div>
              </div>
              <div className="flex h-64 flex-1 flex-col items-center justify-end gap-1.5 pb-1">
                {stackBooks.length === 0 && (
                  <p className="pb-8 text-center text-sm text-on-surface-variant">
                    Nenhum livro em leitura ou na fila.
                  </p>
                )}
                {stackBooks.map((book) => {
                  const cm = spineCm(book.pages);
                  const colorClass =
                    book.status === "READING"
                      ? "bg-emerald-400"
                      : "bg-amber-400";
                  const heightPx = Math.max(28, cm * 18);
                  const wide = book.pages && book.pages > 300;
                  return (
                    <Link
                      key={book.id}
                      href={`/books/${book.id}`}
                      className="group relative flex items-center justify-between overflow-hidden rounded-sm border border-white/10 px-3 shadow-md transition-transform hover:scale-[1.02]"
                      style={{
                        height: heightPx,
                        width: wide ? "96%" : "91.666667%",
                        backgroundColor: book.status === "READING" ? "#1c1d28" : "#232533",
                      }}
                    >
                      <div className={`absolute inset-y-0 left-0 ${wide ? "w-2.5" : "w-1.5"} ${colorClass}`} />
                      <div className="relative z-10 flex items-center gap-2 pl-2">
                        <span className="truncate font-label-sm text-[11px] font-semibold text-on-surface">
                          {book.title}
                        </span>
                        <span className="truncate font-caption text-[10px] text-outline">{book.author}</span>
                      </div>
                      <span className="relative z-10 font-caption text-[10px] font-medium text-on-surface-variant">
                        {cm.toFixed(1).replace(".", ",")} cm
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        ) : viewMode === "list" ? (
          <div className="divide-y divide-outline-variant/20 rounded-xl border border-outline-variant/20 bg-surface-container">
            {filtered.map((book) => (
              <div
                key={book.id}
                draggable={sortBy === "custom"}
                onDragStart={() => handleDragStart(book.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(book.id)}
                onClick={() => router.push(`/books/${book.id}`)}
                className={`group flex cursor-pointer items-center gap-4 p-3 transition-colors hover:bg-surface-container-high/50 ${
                  draggedId === book.id ? "opacity-50" : ""
                }`}
              >
                {sortBy === "custom" && <Icon name="drag_indicator" className="shrink-0 cursor-grab text-outline" />}
                <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-surface-container-high">
                  {book.coverUrl ? (
                    <Image src={book.coverUrl} alt={`Capa de ${book.title}`} fill className="object-cover" sizes="44px" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-outline">
                      <Icon name="menu_book" className="text-xl" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-on-surface">{book.title}</h3>
                  <p className="truncate text-xs text-on-surface-variant">
                    {book.author}
                    {book.publishedDate ? ` · ${book.publishedDate}` : ""}
                    {book.genre ? ` · ${book.genre}` : ""}
                  </p>
                </div>
                <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline ${statusClasses[book.status]}`}>
                  {statusLabels[book.status]}
                </span>
                {book.rating ? (
                  <span className="hidden shrink-0 items-center gap-0.5 text-xs text-yellow-500 sm:flex">
                    <Icon name="star" className="text-sm" fill />
                    {book.rating}
                  </span>
                ) : null}
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(book); }}
                    className="text-xs font-medium text-primary hover:text-primary-fixed-dim"
                  >
                    Editar
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(book); }}
                    className="text-xs font-medium text-error hover:text-error-container"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((book) => (
              <article
                key={book.id}
                draggable={sortBy === "custom"}
                onDragStart={() => handleDragStart(book.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(book.id)}
                onClick={() => router.push(`/books/${book.id}`)}
                className={`group relative cursor-pointer ${draggedId === book.id ? "opacity-50" : ""}`}
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-md border border-outline-variant/30 bg-surface-container shadow-md transition-transform group-hover:-translate-y-1 group-hover:shadow-xl">
                  {book.coverUrl ? (
                    <Image
                      src={book.coverUrl}
                      alt={`Capa de ${book.title}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center p-2 text-center text-outline">
                      <Icon name="menu_book" className="mb-1 text-3xl" />
                      <span className="line-clamp-3 text-[10px] font-medium">{book.title}</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="line-clamp-1 text-[10px] font-medium text-white">{book.title}</p>
                    <p className="line-clamp-1 text-[9px] text-zinc-300">{book.author}</p>
                  </div>
                </div>
                <div className="mx-1 mt-1 h-1.5 rounded-b-sm bg-amber-900/20 dark:bg-amber-100/10" />
              </article>
            ))}
          </div>
        )}

        <section className="relative rounded-lg border border-white/5 bg-surface-container-low/90 p-space-xl backdrop-blur-md">
          <Icon name="format_quote" className="absolute right-4 top-4 select-none text-3xl text-tertiary opacity-30" />
          <p className="font-quote-md text-quote-md italic leading-relaxed text-on-surface">“{quote.text}”</p>
          <div className="mt-space-sm flex items-center gap-space-xs">
            <div className="h-0.5 w-6 bg-primary-container" />
            <span className="font-caption text-caption font-semibold uppercase tracking-wider text-outline">
              {quote.author}
            </span>
          </div>
        </section>
      </main>

      {editingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-on-surface">Editar Livro</h2>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-on-surface-variant">Título</label>
              <input
                type="text"
                value={editingBook.title}
                onChange={(e) => setEditingBook({ ...editingBook, title: e.target.value })}
                className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-on-surface-variant">Autor</label>
              <input
                type="text"
                value={editingBook.author}
                onChange={(e) => setEditingBook({ ...editingBook, author: e.target.value })}
                className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleSearchAuthor}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-outline-variant/30 bg-surface-container px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
              >
                {loading ? "Buscando..." : "Buscar autor"}
              </button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface-variant">Data de publicação</label>
                <input
                  type="text"
                  value={editingBook.publishedDate || ""}
                  onChange={(e) => setEditingBook({ ...editingBook, publishedDate: e.target.value || null })}
                  className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface-variant">Páginas</label>
                <input
                  type="number"
                  min="0"
                  value={editingBook.pages ?? ""}
                  onChange={(e) => setEditingBook({ ...editingBook, pages: e.target.value ? Number(e.target.value) : null })}
                  className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-on-surface-variant">Gênero</label>
              <input
                type="text"
                value={editingBook.genre || ""}
                onChange={(e) => setEditingBook({ ...editingBook, genre: e.target.value || null })}
                placeholder="Ex: Ficção, Romance, Fantasia..."
                list="genre-suggestions"
                className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <datalist id="genre-suggestions">
                {genres.map((g) => <option key={g} value={g} />)}
              </datalist>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-on-surface-variant">Capa</label>
              <input
                type="text"
                value={editingBook.coverUrl || ""}
                onChange={(e) => setEditingBook({ ...editingBook, coverUrl: e.target.value || null })}
                placeholder="URL da capa"
                className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleSearchCover}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-outline-variant/30 bg-surface-container px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
              >
                {loading ? "Buscando..." : "Buscar capa na internet"}
              </button>
              <button
                onClick={handleSearchWikipediaCover}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-outline-variant/30 bg-surface-container px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
              >
                {loading ? "Buscando..." : "Buscar capa na Wikipédia"}
              </button>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-on-surface-variant">Status</label>
              <select
                value={editingBook.status}
                onChange={(e) => setEditingBook({ ...editingBook, status: e.target.value as Book["status"] })}
                className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="READ">Lido</option>
                <option value="READING">Lendo</option>
                <option value="TO_READ">A ler</option>
                <option value="WISHLIST">Desejo</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-on-surface-variant">Sinopse</label>
              <textarea
                value={editingBook.synopsis || ""}
                onChange={(e) => setEditingBook({ ...editingBook, synopsis: e.target.value || null })}
                rows={4}
                className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleGenerateSynopsis}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-amber-500/30 bg-amber-950/30 px-4 py-2 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-950/50 disabled:opacity-60"
              >
                {loading ? "Gerando..." : "Gerar sinopse automaticamente"}
              </button>
              <button
                onClick={handleEnrichBook}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-primary/30 bg-surface-container px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-surface-container-high disabled:opacity-60"
              >
                {loading ? "Buscando..." : "Completar dados vazios"}
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingBook(null)}
                className="rounded-lg border border-outline-variant/30 px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container shadow-md transition-colors hover:bg-inverse-primary disabled:opacity-60"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="fixed bottom-6 right-4 z-40">
        <Link
          href="/scanner"
          className="flex items-center gap-2 rounded-full border border-white/20 bg-primary-container px-space-lg py-space-sm font-label-md text-label-md font-semibold text-on-primary-container shadow-[0_12px_32px_-8px_rgba(91,80,230,0.6)] transition-colors hover:bg-[#6366f1] active:scale-95"
        >
          <Icon name="photo_camera" />
          <span>Escanear Livro</span>
        </Link>
      </aside>
    </div>
  );
}
