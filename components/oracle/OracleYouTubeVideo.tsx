"use client";

import { useEffect, useRef, useState } from "react";
import { loadYouTubeApi, youtubePlaybackError, type YouTubePlayer } from "@/lib/youtube-player";

function EmbeddedVideo({ videoId, title }: { videoId: string; title: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let disposed = false;
    let failed = false;
    let player: YouTubePlayer | undefined;
    const container = host.current;
    if (!container) return;
    const frame = document.createElement("iframe");
    const src = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
    src.search = new URLSearchParams({ enablejsapi: "1", origin: window.location.origin, playsinline: "1", autoplay: "0" }).toString();
    frame.src = src.href;
    frame.title = `Vídeo: ${title}`;
    frame.className = "aspect-video min-h-[200px] w-full rounded-lg border-0";
    frame.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    container.appendChild(frame);
    const destroy = () => {
      try { player?.destroy(); } catch { /* The external player must not prevent local cleanup. */ }
      player = undefined;
      container.replaceChildren();
    };
    const fail = (message: string) => {
      if (disposed || failed) return;
      failed = true;
      clearTimeout(timer);
      destroy();
      setMessage(message);
      setState("failed");
    };
    const timer = window.setTimeout(() => fail("O player demorou para carregar. Você ainda pode abrir o vídeo no YouTube."), 20000);
    void loadYouTubeApi().then(api => {
      if (disposed || failed) return;
      player = new api.Player(frame, { events: {
        onReady: () => { if (!disposed && !failed) { clearTimeout(timer); setState("ready"); } },
        onError: event => fail(youtubePlaybackError(event.data)),
      } });
    }).catch(() => fail("Não foi possível carregar o player. Use Abrir no YouTube."));
    return () => { disposed = true; clearTimeout(timer); destroy(); };
  }, [videoId, title]);
  return (
    <div className="mt-3 min-w-0">
      {state === "loading" && <p role="status" className="mb-2 text-sm text-on-surface-variant">Carregando player do YouTube…</p>}
      {state === "failed" && <p role="status" className="mb-2 text-sm text-on-surface-variant">{message}</p>}
      <div ref={host} />
    </div>
  );
}

export function OracleYouTubeVideo({ videoId, title }: { videoId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  // Parent only passes a validated ID; keep the embedding boundary strict too.
  if (!/^[\w-]{11}$/u.test(videoId)) return null;
  return (
    <div className="mt-3 min-w-0" onKeyDown={event => {
      if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); button.current?.focus(); }
    }}>
      <div className="flex flex-wrap gap-2">
        <button ref={button} type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}
          className="min-h-11 rounded-full border border-primary/50 px-3 text-sm text-primary hover:bg-primary/10">
          {open ? "Fechar vídeo" : "Assistir aqui"}
        </button>
        <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-full border border-tertiary/40 px-3 text-sm text-tertiary hover:bg-tertiary-container/20">
          Abrir no YouTube
        </a>
      </div>
      {open && <EmbeddedVideo key={videoId} videoId={videoId} title={title} />}
    </div>
  );
}
