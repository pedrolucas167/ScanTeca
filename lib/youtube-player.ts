export function youtubeVideoId(value: string | undefined): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    let id: string | null = null;
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      id = url.pathname === "/watch" ? url.searchParams.get("v")
        : /^\/(?:embed|shorts|live)\/([\w-]{11})$/u.exec(url.pathname)?.[1] ?? null;
    }
    return id && /^[\w-]{11}$/u.test(id) ? id : null;
  } catch { return null; }
}

export interface YouTubePlayer { destroy(): void }
export interface YouTubeApi {
  Player: new (frame: HTMLIFrameElement, options: {
    events: { onReady: () => void; onError: (event: { data: number }) => void };
  }) => YouTubePlayer;
}
declare global {
  interface Window { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void }
}

let loading: Promise<YouTubeApi> | undefined;
/** Called only after the reader chooses to load a video. */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YouTubeApi>((resolve, reject) => {
    const script = document.createElement("script");
    const previous = window.onYouTubeIframeAPIReady;
    const restore = () => {
      clearTimeout(timer);
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous;
    };
    const fail = () => { restore(); script.remove(); reject(new Error("YouTube indisponível")); };
    const ready = () => {
      restore();
      if (window.YT?.Player) resolve(window.YT); else fail();
      previous?.();
    };
    const timer = window.setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = ready;
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}

export function youtubePlaybackError(code: number) {
  return code === 101 || code === 150
    ? "Este vídeo não permite reprodução dentro de outros sites. Use Abrir no YouTube."
    : code === 100
      ? "Este vídeo foi removido ou está privado. Você pode conferir a página no YouTube."
      : "Não foi possível reproduzir aqui. Tente abrir o vídeo no YouTube.";
}
