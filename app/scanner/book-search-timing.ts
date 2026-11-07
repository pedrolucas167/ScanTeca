const timingKey = "scanteca:book-search-timing";

type BookSearchTiming =
  | { stage: "results"; outcome: "ok" | "http-error" | "request-error" | "aborted"; status?: number }
  | { stage: "thumbnail"; outcome: "load" | "error" };

function timingEnabled(): boolean {
  try {
    return window.sessionStorage.getItem(timingKey) === "1";
  } catch {
    return false;
  }
}

export function startBookSearchTiming(): number | undefined {
  return timingEnabled() ? performance.now() : undefined;
}

export function logBookSearchTiming(startedAt: number | undefined, timing: BookSearchTiming) {
  if (startedAt === undefined || !timingEnabled()) return;
  const durationMs = Math.round(performance.now() - startedAt);
  // eslint-disable-next-line no-console -- Explicitly enabled, local-only diagnostics.
  console.info("[ScanTeca book search]", { ...timing, durationMs });
}

export function observeBookSearchThumbnail(image: HTMLImageElement | null) {
  if (!image) return;
  const startedAt = startBookSearchTiming();
  if (startedAt === undefined) return;

  const stop = () => {
    image.removeEventListener("load", onLoad);
    image.removeEventListener("error", onError);
  };
  const onLoad = () => {
    stop();
    logBookSearchTiming(startedAt, { stage: "thumbnail", outcome: "load" });
  };
  const onError = () => {
    stop();
    logBookSearchTiming(startedAt, { stage: "thumbnail", outcome: "error" });
  };

  // The next/image onError prop can reassign src to replay hydration errors.
  // Native listeners observe the current request without triggering another one.
  image.addEventListener("load", onLoad);
  image.addEventListener("error", onError);
  if (image.complete && image.naturalWidth > 0) onLoad();
  return stop;
}
