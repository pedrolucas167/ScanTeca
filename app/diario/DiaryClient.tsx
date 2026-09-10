"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CalendarDays, Clock3, Pause, PenLine, Play, Quote, Send, Sparkles } from "lucide-react";

type Book = { id: string; title: string; author: string; coverUrl: string | null; pages: number | null; currentPage: number | null };
type Active = { id: string; startedPage: number; currentPage: number; startedAt: Date | string; book: Book } | null;
type Entry = { id: string; type: "REFLECTION" | "QUOTE" | "OCR"; content: string; page: number | null; tags: string[]; createdAt: Date | string; book: { title: string; author: string } };
type Session = { id: string; startedPage: number; currentPage: number; startedAt: Date | string; durationSec: number | null; book: { title: string; author: string; coverUrl: string | null }; _count: { entries: number } };

export default function DiaryClient({ books, initialActive, sessions, initialEntries }: { books: Book[]; initialActive: Active; sessions: Session[]; initialEntries: Entry[] }) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [bookId, setBookId] = useState(initialActive?.book.id ?? books[0]?.id ?? "");
  const [page, setPage] = useState(String(initialActive?.currentPage ?? initialActive?.book.currentPage ?? 0));
  const [content, setContent] = useState("");
  const [type, setType] = useState<Entry["type"]>("REFLECTION");
  const [tags, setTags] = useState("");
  const [entries, setEntries] = useState(initialEntries);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => { if (!active) return; const update = () => setNow(Date.now()); const initial = setTimeout(update, 0); const timer = setInterval(update, 1000); return () => { clearTimeout(initial); clearInterval(timer); }; }, [active]);
  const elapsed = active ? Math.max(0, Math.floor((now - new Date(active.startedAt).getTime()) / 1000)) : 0;
  const selected = books.find((book) => book.id === bookId);
  const currentBook = active?.book ?? selected;
  const current = Number(page) || 0;
  const percent = currentBook?.pages ? Math.min(100, Math.round((current / currentBook.pages) * 100)) : 0;
  const weekStats = useMemo(() => {
    const limit = now - 7 * 86400000;
    const recent = sessions.filter((session) => new Date(session.startedAt).getTime() >= limit);
    return { sessions: recent.length, pages: recent.reduce((sum, session) => sum + Math.max(0, session.currentPage - session.startedPage), 0), minutes: Math.round(recent.reduce((sum, session) => sum + (session.durationSec ?? 0), 0) / 60) };
  }, [sessions, now]);

  async function start() {
    if (!bookId) return; setBusy(true);
    const response = await fetch("/api/diary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", bookId }) });
    if (response.ok) { const data = await response.json(); const book = books.find((item) => item.id === bookId)!; setActive({ ...data.session, book }); setPage(String(book.currentPage ?? 0)); setNow(Date.now()); }
    setBusy(false);
  }

  async function pause() {
    if (!active) return; setBusy(true);
    const response = await fetch("/api/diary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pause", sessionId: active.id, currentPage: current }) });
    if (response.ok) { setActive(null); router.refresh(); }
    setBusy(false);
  }

  async function saveEntry() {
    if (!currentBook || !content.trim()) return; setBusy(true);
    const response = await fetch("/api/diary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "entry", bookId: currentBook.id, sessionId: active?.id, type, content, page: current || undefined, tags: tags.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean) }) });
    if (response.ok) { const data = await response.json(); setEntries((previous) => [{ ...data.entry, book: { title: currentBook.title, author: currentBook.author } }, ...previous]); setContent(""); setTags(""); }
    setBusy(false);
  }

  return <div className="min-h-screen bg-surface text-on-surface">
    <header className="sticky top-0 z-40 border-b border-outline-variant/20 bg-surface/85 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between"><div className="flex items-center gap-2"><Link href="/jornada" aria-label="Voltar" className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"><ArrowLeft className="h-5 w-5" /></Link><div><h1 className="font-serif text-lg font-semibold">Diário de Leitura</h1><p className="text-[10px] text-on-surface-variant">Memória tangível & RAG</p></div></div><CalendarDays className="h-5 w-5 text-on-surface-variant" /></div>
    </header>
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-5">
      {!currentBook ? <section className="rounded-2xl border border-dashed border-outline-variant p-8 text-center"><BookOpen className="mx-auto h-8 w-8 text-primary" /><p className="mt-3 text-sm text-on-surface-variant">Marque um livro como Lendo para iniciar seu diário.</p><Link href="/" className="mt-4 inline-block rounded-full bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container">Abrir catálogo</Link></section> : <section className="relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container p-4 shadow-xl">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary-container/20 blur-3xl" /><div className="relative flex items-center justify-between"><span className="rounded-full bg-primary-container/15 px-2.5 py-1 text-xs font-semibold text-primary">{active ? "● Sessão em andamento" : "Pronto para ler"}</span>{active && <span className="flex items-center gap-1 text-xs text-on-surface-variant"><Clock3 className="h-3.5 w-3.5 text-tertiary" />{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>}</div>
        {!active && books.length > 1 && <select value={bookId} onChange={(event) => setBookId(event.target.value)} className="relative mt-3 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low p-2 text-sm">{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select>}
        <div className="relative mt-4 flex gap-4"> <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-container-high">{currentBook.coverUrl ? <Image src={currentBook.coverUrl} alt="" fill className="object-cover" sizes="80px" /> : <BookOpen className="absolute inset-0 m-auto h-8 w-8 text-outline" />}</div><div className="min-w-0 flex-1"><p className="text-xs text-tertiary">Livro em mãos</p><h2 className="truncate font-serif text-xl font-semibold">{currentBook.title}</h2><p className="text-sm text-on-surface-variant">{currentBook.author}</p><div className="mt-3 flex items-center gap-2"><label className="text-sm font-semibold">Pág.</label><input type="number" min={0} max={currentBook.pages ?? undefined} value={page} onChange={(event) => setPage(event.target.value)} className="w-20 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2 py-1 text-sm" /><span className="text-xs text-on-surface-variant">de {currentBook.pages ?? "—"}</span><span className="ml-auto text-xs font-semibold text-primary">{percent}%</span></div></div></div>
        <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-surface-container-lowest"><div className="h-full rounded-full bg-gradient-to-r from-primary-container to-primary" style={{ width: `${percent}%` }} /></div>
        <button disabled={busy} onClick={() => active ? void pause() : void start()} className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary-container py-2.5 text-sm font-semibold text-on-primary-container disabled:opacity-50">{active ? <><Pause className="h-4 w-4" />Pausar e registrar</> : <><Play className="h-4 w-4" />Iniciar sessão</>}</button>
      </section>}

      {currentBook && <section><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><PenLine className="h-4 w-4 text-tertiary" />Diálogo interior & reflexão</h3><div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4"><div className="mb-3 flex gap-2">{(["REFLECTION", "QUOTE", "OCR"] as const).map((item) => <button key={item} onClick={() => setType(item)} className={`rounded-full px-3 py-1 text-xs ${type === item ? "bg-primary-container text-on-primary-container" : "bg-surface-container text-on-surface-variant"}`}>{item === "REFLECTION" ? "Reflexão" : item === "QUOTE" ? "Citação" : "Texto OCR"}</button>)}</div><div className="relative"><textarea value={content} onChange={(event) => setContent(event.target.value)} rows={4} maxLength={5000} placeholder={type === "QUOTE" ? "Transcreva uma passagem marcante..." : "Escreva sua reflexão imediata sobre a leitura..."} className="w-full resize-none rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 pr-11 text-sm outline-none focus:border-primary" /><button onClick={() => void saveEntry()} disabled={busy || !content.trim()} aria-label="Salvar" className="absolute bottom-3 right-3 rounded-full bg-primary-container p-2 text-on-primary-container disabled:opacity-40"><Send className="h-4 w-4" /></button></div><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Contexto: noturna, capítulo 3 (separe por vírgulas)" className="mt-2 w-full rounded-lg border border-outline-variant/20 bg-transparent px-2 py-1.5 text-xs outline-none" /></div></section>}

      <section><div className="mb-2 flex justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-tertiary" />Anotações & citações</h3><span className="text-xs text-on-surface-variant">{entries.length} recentes</span></div><div className="space-y-2">{entries.slice(0, 8).map((entry) => <article key={entry.id} className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-4"><div className="flex justify-between text-[11px] text-tertiary"><span>{entry.type === "REFLECTION" ? "Reflexão" : entry.type === "QUOTE" ? "Citação" : "OCR"}{entry.page ? ` · Página ${entry.page}` : ""}</span><span>{new Date(entry.createdAt).toLocaleDateString("pt-BR")}</span></div><p className={`mt-2 text-sm leading-relaxed ${entry.type !== "REFLECTION" ? "border-l-2 border-primary pl-3 font-serif italic" : ""}`}>{entry.content}</p><p className="mt-2 text-[10px] text-on-surface-variant">{entry.book.title}{entry.tags.length ? ` · ${entry.tags.map((tag) => `#${tag}`).join(" ")}` : ""}</p><Link href={`/oracle?question=${encodeURIComponent(`Converse comigo sobre esta anotação de ${entry.book.title}: ${entry.content}`)}`} className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary"><Quote className="h-3.5 w-3.5" />Conversar com o Oráculo</Link></article>)}</div></section>

      <section><h3 className="mb-2 text-sm font-semibold">Ritmo físico semanal</h3><div className="grid grid-cols-3 gap-2">{[["Sessões", weekStats.sessions], ["Páginas", weekStats.pages], ["Minutos", weekStats.minutes]].map(([label, value]) => <div key={label} className="rounded-xl border border-outline-variant/25 bg-surface-container p-3"><p className="text-xs text-on-surface-variant">{label}</p><p className="mt-2 font-serif text-2xl font-semibold">{value}</p></div>)}</div></section>

      <section><h3 className="mb-2 text-sm font-semibold">Sessões anteriores</h3><div className="space-y-2">{sessions.slice(0, 5).map((session) => <div key={session.id} className="flex items-center gap-3 rounded-xl border border-outline-variant/25 bg-surface-container-low p-3"><div className="relative h-14 w-10 overflow-hidden rounded bg-surface-container-high">{session.book.coverUrl && <Image src={session.book.coverUrl} alt="" fill className="object-cover" sizes="40px" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{session.book.title}</p><p className="text-xs text-on-surface-variant">{Math.round((session.durationSec ?? 0) / 60)} min · {Math.max(0, session.currentPage - session.startedPage)} págs · {session._count.entries} notas</p></div></div>)}</div></section>
    </main>
  </div>;
}
