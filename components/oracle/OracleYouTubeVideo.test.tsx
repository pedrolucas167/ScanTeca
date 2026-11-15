// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadYouTubeApi, type YouTubeApi } from "@/lib/youtube-player";
import { OracleYouTubeVideo } from "./OracleYouTubeVideo";

vi.mock("@/lib/youtube-player", async original => ({ ...await original<typeof import("@/lib/youtube-player")>(), loadYouTubeApi: vi.fn() }));
let events: ConstructorParameters<YouTubeApi["Player"]>[1]["events"];
const destroyed = vi.fn();
beforeEach(() => {
  destroyed.mockClear();
  vi.mocked(loadYouTubeApi).mockResolvedValue({ Player: class {
    constructor(private frame: HTMLIFrameElement, options: ConstructorParameters<YouTubeApi["Player"]>[1]) { events = options.events; }
    destroy() { destroyed(); this.frame.remove(); }
  } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });
const view = () => render(<OracleYouTubeVideo videoId="M7lc1UVf-VE" title="Resenha de um livro" />);
const open = async () => { await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Assistir aqui" })); }); };

it("loads nothing until click, keeps the external link and closes without leaking the player", async () => {
  render(<StrictMode><OracleYouTubeVideo videoId="M7lc1UVf-VE" title="Resenha de um livro" /></StrictMode>);
  expect(loadYouTubeApi).not.toHaveBeenCalled();
  expect(document.querySelector("iframe")).toBeNull();
  const link = screen.getByRole("link", { name: "Abrir no YouTube" });
  expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=M7lc1UVf-VE");
  await open();
  const frame = screen.getByTitle("Vídeo: Resenha de um livro");
  const url = new URL(frame.getAttribute("src")!);
  expect(url.hostname).toBe("www.youtube-nocookie.com");
  expect(url.searchParams.get("autoplay")).toBe("0");
  expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
  act(() => events.onReady());
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Fechar vídeo" }));
  expect(document.querySelector("iframe")).toBeNull();
  expect(destroyed).toHaveBeenCalled();
  expect(screen.getByRole("link")).toBe(link);
});

it.each([101, 150, 100, 153, 5])("keeps the YouTube link when playback fails (%s)", async code => {
  view(); await open();
  act(() => events.onError({ data: code }));
  expect(screen.getByRole("status").textContent).toContain(code === 101 || code === 150 ? "não permite reprodução" : code === 100 ? "removido ou está privado" : "Não foi possível reproduzir");
  expect(screen.getByRole("link", { name: "Abrir no YouTube" })).toBeTruthy();
  expect(document.querySelector("iframe")).toBeNull();
  act(() => events.onReady());
  expect(screen.getByRole("status")).toBeTruthy();
});

it("keeps the fallback if the API script cannot load", async () => {
  vi.mocked(loadYouTubeApi).mockRejectedValueOnce(new Error("blocked"));
  view(); await open();
  expect(screen.getByRole("status").textContent).toContain("Não foi possível carregar");
  expect(screen.getByRole("link")).toBeTruthy();
});

it("stops waiting after timeout, keeping the fallback", async () => {
  vi.useFakeTimers(); view(); await open();
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(screen.getByRole("status").textContent).toContain("demorou para carregar");
  expect(screen.getByRole("link")).toBeTruthy();
});
