"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookPlus, Check } from "lucide-react";

interface ReadingBook {
  id: string;
  title: string;
  currentPage: number | null;
  pages: number | null;
}

export default function QuickLog({ books }: { books: ReadingBook[] }) {
  const router = useRouter();
  const [bookId, setBookId] = useState(books[0]?.id ?? "");
  const [pages, setPages] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (books.length === 0) return null;

  const selected = books.find((b) => b.id === bookId);

  const submit = async () => {
    const n = Number(pages);
    if (!selected || !Number.isInteger(n) || n < 1) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/books", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          currentPage: (selected.currentPage ?? 0) + n,
        }),
      });
      if (res.ok) {
        setFeedback(`+${n} ${n === 1 ? "página" : "páginas"} registradas!`);
        setPages("");
        router.refresh();
      } else {
        setFeedback("Erro ao registrar");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-center gap-2">
        <BookPlus className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <span className="text-sm font-medium text-foreground">Hoje eu li</span>
        <input
          type="number"
          min={1}
          value={pages}
          onChange={(e) => setPages(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="20"
          className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-center text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
        />
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          páginas de
        </span>
        <select
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
          className="max-w-48 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
        >
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        <button
          onClick={submit}
          disabled={saving || !pages || Number(pages) < 1}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? "Salvando..." : "Registrar"}
        </button>
        {feedback && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {feedback}
          </span>
        )}
      </div>
    </div>
  );
}
