// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { youtubeVideoId } from "./youtube-player";

afterEach(() => { vi.useRealTimers(); delete window.YT; delete window.onYouTubeIframeAPIReady; document.head.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]').forEach(script => script.remove()); });

it.each([
  "https://www.youtube.com/watch?v=M7lc1UVf-VE&t=15", "https://youtu.be/M7lc1UVf-VE",
  "https://m.youtube.com/shorts/M7lc1UVf-VE", "https://youtube.com/live/M7lc1UVf-VE",
])("recognizes a validated video ID from %s", url => { expect(youtubeVideoId(url)).toBe("M7lc1UVf-VE"); });

it.each(["javascript:alert(1)", "https://youtube.com.evil.example/watch?v=M7lc1UVf-VE",
  "https://youtube.com@evil.example/watch?v=M7lc1UVf-VE", "https://user:secret@youtube.com/watch?v=M7lc1UVf-VE",
  "https://youtube.com/watch?v=bad", "https://youtu.be/M7lc1UVf-VE/extra", "https://youtube.com/playlist?list=123", undefined,
])("does not embed untrusted or unsupported URL %s", url => { expect(youtubeVideoId(url)).toBeNull(); });

it("loads one shared API script and resolves concurrent readers", async () => {
  vi.resetModules();
  const { loadYouTubeApi } = await import("./youtube-player");
  const first = loadYouTubeApi();
  const second = loadYouTubeApi();
  expect(first).toBe(second);
  expect(document.head.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')).toHaveLength(1);
  window.YT = { Player: class { destroy() {} } };
  window.onYouTubeIframeAPIReady?.();
  await expect(first).resolves.toBe(window.YT);
});

it("reports script failure and permits a fresh attempt", async () => {
  vi.resetModules();
  const { loadYouTubeApi } = await import("./youtube-player");
  const failed = loadYouTubeApi();
  const rejection = expect(failed).rejects.toThrow("YouTube indisponível");
  document.head.querySelector("script")?.dispatchEvent(new Event("error"));
  await rejection;
  const retry = loadYouTubeApi();
  window.YT = { Player: class { destroy() {} } };
  window.onYouTubeIframeAPIReady?.();
  await expect(retry).resolves.toBe(window.YT);
});

it("rejects API loading after a bounded timeout", async () => {
  vi.useFakeTimers(); vi.resetModules();
  const { loadYouTubeApi } = await import("./youtube-player");
  const pending = expect(loadYouTubeApi()).rejects.toThrow("YouTube indisponível");
  await vi.advanceTimersByTimeAsync(15000);
  await pending;
  expect(document.head.querySelector('script[src="https://www.youtube.com/iframe_api"]')).toBeNull();
});
