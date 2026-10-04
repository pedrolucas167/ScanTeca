"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Quote, Send } from "lucide-react";

interface Reply {
  id: string;
  userName: string | null;
  content: string;
  quote: string | null;
}

interface Discussion {
  id: string;
  title: string;
  content: string;
  quote: string | null;
  userName: string | null;
  replies: Reply[];
}

export function BookDiscussions({ bookId }: { bookId: string }) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [quote, setQuote] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openReply, setOpenReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/books/${bookId}/discussions`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar as conversas.");
        return response.json() as Promise<{ discussions: Discussion[] }>;
      })
      .then((data) => setDiscussions(data.discussions))
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Erro ao carregar conversas."))
      .finally(() => setLoading(false));
  }, [bookId]);

  const createDiscussion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) return;
    const response = await fetch(`/api/books/${bookId}/discussions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, quote: quote || undefined }),
    });
    if (!response.ok) {
      setMessage("Não foi possível iniciar a conversa.");
      return;
    }
    const data = (await response.json()) as { discussion: Discussion };
    setDiscussions((current) => [data.discussion, ...current]);
    setTitle("");
    setContent("");
    setQuote("");
  };

  const createReply = async (discussionId: string) => {
    const draft = replyDrafts[discussionId]?.trim();
    if (!draft) return;
    const response = await fetch(`/api/books/${bookId}/discussions/${discussionId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });
    if (!response.ok) {
      setMessage("Não foi possível publicar a resposta.");
      return;
    }
    const data = (await response.json()) as { reply: Reply };
    setDiscussions((current) => current.map((discussion) =>
      discussion.id === discussionId
        ? { ...discussion, replies: [...discussion.replies, data.reply] }
        : discussion
    ));
    setReplyDrafts((current) => ({ ...current, [discussionId]: "" }));
  };

  return (
    <section className="mt-6 rounded-xl border border-outline-variant/30 bg-surface-container-low p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Conversas sobre este livro</h2>
          <p className="text-xs text-on-surface-variant">Compartilhe interpretações, dúvidas e trechos marcantes. 💬</p>
        </div>
      </div>

      <form onSubmit={createDiscussion} className="mb-6 space-y-2">
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Título da conversa" className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary" />
        <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} rows={3} placeholder="O que este livro despertou em você? 📚" className="w-full resize-none rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary" />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Quote className="absolute left-3 top-2.5 h-4 w-4 text-primary" />
            <input value={quote} onChange={(event) => setQuote(event.target.value)} maxLength={1000} placeholder="Citação opcional" className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest py-2 pl-9 pr-3 text-xs outline-none focus:border-primary" />
          </div>
          <button type="submit" disabled={!title.trim() || !content.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container px-3 py-2 text-xs font-semibold text-on-primary-container disabled:opacity-40"><Send className="h-3.5 w-3.5" />Publicar</button>
        </div>
      </form>

      {message && <p className="mb-3 text-xs text-error">{message}</p>}
      {loading && <p className="text-sm text-on-surface-variant">Carregando conversas... 📖</p>}
      {!loading && discussions.length === 0 && <p className="text-sm text-on-surface-variant">Ainda não há conversas. Comece a primeira!</p>}
      <div className="space-y-4">
        {discussions.map((discussion) => (
          <article key={discussion.id} className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
            <p className="text-xs font-semibold text-primary">{discussion.userName || "Leitor anônimo"}</p>
            <h3 className="mt-1 font-semibold">{discussion.title}</h3>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">{discussion.content}</p>
            {discussion.quote && <blockquote className="mt-3 border-l-2 border-primary pl-3 text-xs italic text-on-surface-variant">“{discussion.quote}”</blockquote>}
            {discussion.replies.map((reply) => (
              <div key={reply.id} className="mt-3 rounded-lg bg-surface-container-lowest p-3 text-xs">
                <span className="font-semibold text-primary">{reply.userName || "Leitor anônimo"}:</span> {reply.content}
              </div>
            ))}
            {openReply === discussion.id && (
              <div className="mt-3 flex gap-2">
                <input value={replyDrafts[discussion.id] || ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [discussion.id]: event.target.value }))} maxLength={2000} placeholder="Responda com respeito e curiosidade... 💡" className="min-w-0 flex-1 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-xs outline-none focus:border-primary" />
                <button type="button" onClick={() => void createReply(discussion.id)} className="rounded-lg bg-primary-container p-2 text-on-primary-container"><Send className="h-4 w-4" /></button>
              </div>
            )}
            <button type="button" onClick={() => setOpenReply((current) => current === discussion.id ? null : discussion.id)} className="mt-3 text-xs font-semibold text-primary hover:underline">
              {openReply === discussion.id ? "Fechar resposta" : `Responder (${discussion.replies.length})`}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
