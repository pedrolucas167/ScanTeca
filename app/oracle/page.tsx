"use client";

import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";

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

const DEFAULT_SUGGESTIONS = [
  "O que ler num fim de semana chuvoso?",
  "Livros sobre viagens no tempo",
  "Volume mais antigo do acervo?",
  "+500 páginas não lidas",
];

export default function OraclePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const micSupported = useSyncExternalStore(
    () => () => {},
    () =>
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia,
    () => false
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadingRef = useRef(false);
  const voiceOnRef = useRef(false);
  const audioQueueRef = useRef<Promise<Blob | null>[]>([]);
  const audioPlayingRef = useRef(false);
  const audioDoneRef = useRef<(() => void) | null>(null);
  const ttsBufferRef = useRef("");
  const micBusyRef = useRef(false);
  const streamDoneRef = useRef(true);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    fetch("/api/oracle")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.messages?.length) {
          setMessages(
            data.messages.map(
              (m: { role: string; content: string; sources?: Source[] }) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
                sources: m.sources ?? undefined,
              })
            )
          );
        }
        if (data?.suggestions?.length) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {});
  }, []);

  const stopAudio = () => {
    audioQueueRef.current = [];
    ttsBufferRef.current = "";
    audioDoneRef.current?.();
    audioDoneRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
  };

  const enqueueSpeech = (text: string) => {
    const clean = text.replace(/[*_#`>]/g, "").trim();
    if (!clean) return;
    const p = fetch("/api/oracle/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean }),
    })
      .then((r) => (r.ok ? r.blob() : null))
      .catch(() => null);
    audioQueueRef.current.push(p);
    void drainAudioQueue();
  };

  const drainAudioQueue = async () => {
    if (audioPlayingRef.current) return;
    audioPlayingRef.current = true;
    while (audioQueueRef.current.length > 0) {
      const blob = await audioQueueRef.current.shift()!;
      if (!blob || blob.size === 0) continue;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      await new Promise<void>((resolve) => {
        audioDoneRef.current = resolve;
        const done = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onended = done;
        audio.onerror = done;
        audio.play().catch(done);
      });
      audioDoneRef.current = null;
      audioRef.current = null;
    }
    audioPlayingRef.current = false;
    maybeAutoListen();
  };

  const maybeAutoListen = () => {
    if (
      voiceOnRef.current &&
      micSupported &&
      streamDoneRef.current &&
      !mediaRecorderRef.current &&
      !micBusyRef.current &&
      !audioPlayingRef.current &&
      audioQueueRef.current.length === 0
    ) {
      void handleMic();
    }
  };

  const feedTts = (chunk: string, flush = false) => {
    ttsBufferRef.current += chunk;
    const re = /[^.!?…\n]+[.!?…]+|[^\n]+\n/g;
    let consumed = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(ttsBufferRef.current)) !== null) {
      if (m[0].trim()) enqueueSpeech(m[0]);
      consumed = re.lastIndex;
    }
    ttsBufferRef.current = ttsBufferRef.current.slice(consumed);
    if (flush) {
      const tail = ttsBufferRef.current.trim();
      if (tail) enqueueSpeech(tail);
      ttsBufferRef.current = "";
    }
  };

  const speak = async (text: string) => {
    try {
      stopAudio();
      const res = await fetch("/api/oracle/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        maybeAutoListen();
      };
      await audio.play();
    } catch {}
  };

  const toggleVoice = () => {
    const next = !voiceOn;
    voiceOnRef.current = next;
    setVoiceOn(next);
    if (!next) stopAudio();
  };

  const readOracleStream = async (res: Response): Promise<string> => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

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
          if (json.transcript) {
            setMessages((prev) => {
              const updated = [...prev];
              const userIdx = updated.length - 2;
              if (updated[userIdx]?.role === "user") {
                updated[userIdx] = {
                  ...updated[userIdx],
                  content: json.transcript,
                };
              }
              return updated;
            });
          }
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
            fullText += json.text;
            if (voiceOnRef.current) feedTts(json.text);
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: updated[updated.length - 1].content + json.text,
              };
              return updated;
            });
          }
        } catch {}
      }
    }
    if (voiceOnRef.current) feedTts("", true);
    return fullText;
  };

  const sendMessage = async (question: string) => {
    if (!question || loadingRef.current) return;
    loadingRef.current = true;
    streamDoneRef.current = false;

    stopAudio();
    setInput("");
    setError(null);
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);

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

      await readOracleStream(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de rede");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      loadingRef.current = false;
      streamDoneRef.current = true;
      setLoading(false);
      inputRef.current?.focus();
      maybeAutoListen();
    }
  };

  const sendAudio = async (blob: Blob) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    streamDoneRef.current = false;

    stopAudio();
    setError(null);
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "🎤 Transcrevendo áudio..." },
      { role: "assistant", content: "" },
    ]);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
      const base64 = dataUrl.split(",")[1];
      const format = blob.type.split("/")[1]?.split(";")[0] || "webm";

      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: { data: base64, format } }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao consultar o Oráculo");
      }

      await readOracleStream(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de rede");
      setMessages((prev) => prev.slice(0, -2));
    } finally {
      loadingRef.current = false;
      streamDoneRef.current = true;
      setLoading(false);
      maybeAutoListen();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input.trim());
  };

  const handleMic = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (micBusyRef.current) return;
    micBusyRef.current = true;
    try {
      stopAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        mediaRecorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        if (blob.size > 0) void sendAudio(blob);
      };
      mediaRecorderRef.current = rec;
      setRecording(true);
      rec.start();
    } catch {
      setError("Não consegui acessar o microfone. Verifique a permissão.");
    } finally {
      micBusyRef.current = false;
    }
  };

  const handleClear = async () => {
    stopAudio();
    setMessages([]);
    setError(null);
    await fetch("/api/oracle", { method: "DELETE" }).catch(() => {});
  };

  const activeSuggestions =
    suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS;

  return (
    <div className="flex flex-1 flex-col bg-surface text-on-surface">
      {/* Header */}
      <header className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-outline-variant/30 bg-surface/80 px-4 py-3 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-space-xs">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary-container/20">
            <Icon name="auto_awesome" className="text-xl text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-space-2xs">
              <h1 className="font-headline-md text-headline-md italic leading-none text-on-surface">
                Oráculo
              </h1>
              <span className="rounded bg-primary-container/20 px-1.5 py-0.5 font-caption text-caption font-semibold uppercase tracking-widest text-primary">
                RAG
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <p className="font-caption text-[11px] leading-tight text-on-surface-variant">
                342 volumes indexados <span className="text-outline">(pgvector)</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-space-2xs">
          <span className="flex items-center gap-1 rounded-full border border-outline-variant/40 bg-surface-container px-2.5 py-1 font-label-sm text-label-sm text-on-surface">
            <Icon name="shelves" className="text-sm text-tertiary" />
            <span>Acervo Todo</span>
            <Icon name="expand_more" className="text-xs text-outline" />
          </span>
          <button
            onClick={toggleVoice}
            title={voiceOn ? "Desativar voz" : "Oráculo fala as respostas"}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 active:scale-95 ${
              voiceOn
                ? "bg-primary-container/20 text-primary"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            <Icon name="tune" className="text-lg" />
          </button>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              title="Limpar conversa"
              className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface active:scale-95"
            >
              <Icon name="delete" className="text-lg" />
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-56 pt-4">
        {/* Welcome card */}
        <div className="relative mb-6 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest/60 p-space-md backdrop-blur-sm">
          <div className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-primary-container/10 blur-2xl" />
          <div className="relative flex items-start gap-space-xs">
            <Icon
              name="psychology"
              className="mt-0.5 text-lg text-primary"
            />
            <div>
              <p className="font-label-md text-label-md font-semibold text-primary">
                Diálogo Sináptico com sua Estante
              </p>
              <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                Você está conversando com os livros da sua estante física.
                Pergunte sobre temas cruzados, ideias ou onde encontrar uma
                citação exata.
              </p>
            </div>
          </div>
        </div>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {activeSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput(suggestion);
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-outline-variant/40 bg-surface-container px-3 py-1.5 text-left font-caption text-caption text-on-surface transition-colors hover:border-primary/50 hover:bg-surface-container-high"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="mb-6">
            {msg.role === "user" ? (
              <div className="flex flex-col items-end gap-1 pl-8">
                <div className="rounded-2xl rounded-tr-xs border border-white/10 bg-primary-container px-space-md py-space-sm shadow-md">
                  <p className="font-body-md text-body-md leading-relaxed text-white">
                    {msg.content}
                  </p>
                </div>
                <div className="flex items-center gap-1 pr-1 font-caption text-caption text-outline-variant">
                  <span>Você</span>
                  <span>•</span>
                  <span>
                    {new Date().toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-space-sm pr-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/20">
                    <Icon name="auto_awesome" className="text-xs text-primary" />
                  </div>
                  <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-primary">
                    Oráculo da Bibliotheca
                  </span>
                  {!loading && i === messages.length - 1 && (
                    <span className="font-caption text-caption text-outline">
                      retrieval em 180ms
                    </span>
                  )}
                </div>
                <div className="w-full space-y-space-md rounded-2xl rounded-tl-xs border border-outline-variant/30 bg-surface-container-low p-space-md shadow-sm">
                  <p className="whitespace-pre-wrap font-body-md text-body-md leading-relaxed text-on-surface">
                    {msg.content}
                    {loading && i === messages.length - 1 && (
                      <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-primary" />
                    )}
                  </p>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="space-y-2.5">
                      {msg.sources.map((s) => (
                        <Link
                          key={s.id}
                          href={`/books/${s.id}`}
                          className="flex items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest/80 p-space-sm transition-colors hover:border-primary/50"
                        >
                          <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-md border border-outline-variant/50 bg-surface-container-high shadow-sm">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary-container/40 to-secondary-container/30" />
                            <span className="absolute bottom-1 right-1 rounded bg-surface-dim/90 px-1 font-mono text-[9px] text-primary">
                              vol.
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-caption text-caption font-semibold uppercase tracking-wider text-primary">
                                Fonte
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-container/20 px-2 py-0.5 text-[11px] text-primary">
                                <Icon name="bookmark" className="text-xs" />
                                Acervo
                              </span>
                            </div>
                            <h3 className="mt-1 truncate font-quote-md text-quote-md font-semibold text-on-surface">
                              {s.title}
                            </h3>
                            <p className="font-body-sm text-body-sm text-on-surface-variant">
                              {s.author}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {msg.content &&
                    !(loading && i === messages.length - 1) &&
                    msg.role === "assistant" && (
                      <button
                        onClick={() => speak(msg.content)}
                        title="Ouvir resposta"
                        className="flex items-center gap-1 font-caption text-caption text-outline transition-colors hover:text-on-surface"
                      >
                        <Icon name="volume_up" className="text-sm" />
                        <span>Ouvir</span>
                      </button>
                    )}
                </div>
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="mb-4 rounded-lg bg-error-container/20 p-3 font-body-sm text-body-sm text-error">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Fixed bottom */}
      <div className="pointer-events-none fixed bottom-0 left-0 z-40 w-full bg-gradient-to-t from-surface via-surface/95 to-transparent pt-4">
        <div className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-2.5 px-4 pb-4">
          {messages.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
              {activeSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container/90 px-3 py-1.5 font-caption text-caption text-on-surface shadow-sm transition-colors hover:border-primary/50 hover:bg-surface-container-high active:scale-95"
                >
                  <Icon name="auto_awesome" className="text-xs text-primary" />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="relative flex items-center gap-1.5 rounded-full border border-outline-variant/50 bg-surface-container/95 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-outline-variant/30 bg-surface-container-high py-1 pl-2.5 pr-2 text-[11px] font-medium text-on-surface-variant">
              <Icon name="local_library" className="text-xs text-primary" />
              <span className="hidden sm:inline">Estante</span>
              <Icon name="unfold_more" className="text-[10px]" />
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                recording
                  ? "Gravando... toque no microfone para enviar"
                  : "Pergunte ao seu acervo físico..."
              }
              disabled={loading}
              className="flex-1 bg-transparent border-0 px-1 py-1 font-body-sm text-body-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-0 disabled:opacity-60"
            />
            {micSupported && (
              <button
                type="button"
                onClick={handleMic}
                disabled={loading}
                title={recording ? "Parar e enviar" : "Falar com o Oráculo"}
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors active:scale-90 disabled:opacity-50 ${
                  recording
                    ? "animate-pulse bg-error text-white"
                    : "text-outline hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <Icon name="mic" className="text-lg" />
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-container text-white shadow-[0_0_16px_rgba(91,80,230,0.5)] transition-all hover:bg-inverse-primary active:scale-95 disabled:opacity-50"
            >
              <Icon name="arrow_upward" className="text-lg" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
