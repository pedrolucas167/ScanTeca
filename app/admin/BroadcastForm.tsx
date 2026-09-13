"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export default function BroadcastForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          ...(url.trim() ? { url: url.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Falha ao enviar");
      setResult(
        `Enviada para ${data.sent} dispositivo(s)` +
          (data.removed ? ` · ${data.removed} inscrição(ões) expirada(s) removida(s)` : "") +
          (data.failed ? ` · ${data.failed} falha(s)` : "")
      );
      setTitle("");
      setBody("");
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de rede");
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
        Nova notificação
      </h2>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Título
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          required
          placeholder="Ex.: Novidade no Scanteca"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Mensagem
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={240}
          required
          rows={3}
          placeholder="Ex.: O Oráculo agora busca livros fora do seu acervo."
          className={`${inputCls} resize-none`}
        />
        <p className="mt-1 text-right text-[11px] text-zinc-400">
          {body.length}/240
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Link ao tocar (opcional)
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={500}
          placeholder="/oracle ou https://..."
          className={inputCls}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}
      {result && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
          {result}
        </p>
      )}

      <button
        type="submit"
        disabled={sending || !title.trim() || !body.trim()}
        className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {sending ? "Enviando..." : "Disparar para todos"}
      </button>
    </form>
  );
}
