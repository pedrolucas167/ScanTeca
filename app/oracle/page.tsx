"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Send, Sparkles } from "lucide-react";

interface Source {
  id: string;
  title: string;
  author: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export default function OraclePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setError(null);
    setLoading(true);

    const userMsg: Message = { role: "user", content: question };
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao consultar o Oráculo");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;

          try {
            const json = JSON.parse(payload);
            if (json.sources) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  sources: json.sources,
                };
                return updated;
              });
            }
            if (json.text) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + json.text,
                };
                return updated;
              });
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de rede");
      setMessages((prev) => prev.slice(0, -1)); // remove empty assistant msg
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/"
            className="text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="font-serif text-xl font-semibold text-foreground">
              Oráculo
            </h1>
          </div>
          <p className="ml-auto hidden text-xs text-zinc-400 sm:block dark:text-zinc-500">
            Pergunte sobre o seu acervo
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="mb-4 rounded-2xl bg-indigo-100 p-4 dark:bg-indigo-900/30">
                <Sparkles className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                Consulte o Oráculo
              </h2>
              <p className="mx-auto mt-2 max-w-md font-serif text-sm italic text-zinc-500 dark:text-zinc-400">
                &ldquo;Sempre imaginei que o paraíso fosse uma espécie de
                biblioteca.&rdquo;
              </p>
              <div className="mt-6 grid w-full max-w-md gap-2">
                {[
                  "Quais livros de ficção científica eu tenho?",
                  "Me recomende um livro do meu acervo para ler agora",
                  "Qual livro da minha coleção fala sobre filosofia?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-left text-sm text-zinc-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "border border-zinc-200 bg-white text-foreground dark:border-zinc-700 dark:bg-zinc-900"
                }`}
              >
                {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5 border-b border-zinc-100 pb-2 dark:border-zinc-800">
                    {msg.sources.map((s) => (
                      <Link
                        key={s.id}
                        href={`/books/${s.id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                      >
                        <BookOpen className="h-3 w-3" />
                        {s.title}
                      </Link>
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content}
                  {msg.role === "assistant" && loading && i === messages.length - 1 && (
                    <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-indigo-400" />
                  )}
                </p>
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte ao Oráculo sobre seus livros..."
            disabled={loading}
            className="flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm text-foreground placeholder-zinc-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-full bg-indigo-600 p-3 text-white shadow-md transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
