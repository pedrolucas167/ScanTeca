"use client";

import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Mic,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";

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
    } catch {
    }
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
        } catch {
        }
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

  return (
    <div className="flex flex-1 flex-col">
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
            Pergunte sobre o seu acervo — ele lembra de você
          </p>
          <button
            onClick={toggleVoice}
            title={
              voiceOn
                ? "Desativar voz do Oráculo"
                : "Oráculo fala as respostas"
            }
            className={`rounded-full p-2 transition-colors ${
              voiceOn
                ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"
                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            {voiceOn ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </button>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              title="Limpar conversa"
              className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center sm:py-16">
              <div className="mb-4 rounded-2xl bg-indigo-100 p-4 dark:bg-indigo-900/30">
                <Sparkles className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                Consulte o Oráculo
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                O Oráculo conhece a ficha de cada livro do seu catálogo —
                título, autor, sinopse e gênero. Pergunte em linguagem natural
                e ele responde com base no <strong>seu</strong> acervo,
                indicando quais livros usou como referência. Ele lembra das
                suas conversas e aprende suas preferências a cada interação.
              </p>
              <div className="mx-auto mt-5 grid max-w-lg grid-cols-1 gap-2 text-left sm:grid-cols-3">
                <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                  <p className="text-xs font-semibold text-foreground">
                    Encontra por tema
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    &ldquo;O que eu tenho sobre filosofia?&rdquo;
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                  <p className="text-xs font-semibold text-foreground">
                    Recomenda leituras
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    &ldquo;O que ler depois do meu último livro?&rdquo;
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                  <p className="text-xs font-semibold text-foreground">
                    Conversa sobre o acervo
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    &ldquo;Qual meu livro mais denso?&rdquo;
                  </p>
                </div>
              </div>
              <p className="mx-auto mt-5 max-w-md font-serif text-sm italic text-zinc-500 dark:text-zinc-400">
                &ldquo;Sempre imaginei que o paraíso fosse uma espécie de
                biblioteca.&rdquo;
              </p>
              <div className="mt-6 grid w-full max-w-md gap-2">
                {(suggestions.length > 0
                  ? suggestions
                  : [
                      "Quais livros eu tenho no meu acervo?",
                      "Me recomende um livro para ler agora",
                      "Por onde eu começo?",
                    ]
                ).map((suggestion) => (
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
                {msg.role === "assistant" &&
                  msg.content &&
                  !(loading && i === messages.length - 1) && (
                    <button
                      onClick={() => speak(msg.content)}
                      title="Ouvir resposta"
                      className="mt-1.5 text-zinc-400 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  )}
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

      <div className="border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        {messages.length > 0 && suggestions.length > 0 && !loading && (
          <div className="mx-auto mb-2 flex max-w-3xl gap-2 overflow-x-auto pb-1">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setInput(s);
                  inputRef.current?.focus();
                }}
                title="Clique para preencher — edite ou envie"
                className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              recording
                ? "Gravando... toque no microfone para enviar"
                : "Pergunte ao Oráculo sobre seus livros..."
            }
            disabled={loading}
            className="flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm text-foreground placeholder-zinc-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
          />
          {micSupported && (
            <button
              type="button"
              onClick={handleMic}
              disabled={loading}
              title={recording ? "Parar e enviar" : "Falar com o Oráculo"}
              className={`rounded-full p-3 shadow-md transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                recording
                  ? "animate-pulse bg-red-500 text-white hover:bg-red-600"
                  : "border border-zinc-300 bg-white text-zinc-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-indigo-400"
              }`}
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
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
