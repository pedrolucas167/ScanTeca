import { afterEach, describe, expect, it, vi } from "vitest";
import { requestFeed } from "./request-feed";
afterEach(() => vi.unstubAllGlobals());
describe("carregamento do feed", () => {
  it("diferencia sessão expirada de erro técnico", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    expect(await requestFeed()).toEqual({ kind: "unauthorized" });
  });
  it("trata coleção vazia como sucesso", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ posts: [] })));
    expect(await requestFeed()).toEqual({ kind: "success", posts: [] });
  });
  it("permite tentar novamente depois de uma falha de rede", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(Response.json({ posts: [{ id: "post" }] }));
    vi.stubGlobal("fetch", fetch);
    expect(await requestFeed()).toMatchObject({ kind: "error", message: expect.stringContaining("conexão") });
    expect(await requestFeed()).toEqual({ kind: "success", posts: [{ id: "post" }] });
  });
  it("identifica falha do servidor sem confundir com falta de sessão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    expect(await requestFeed()).toMatchObject({ kind: "error", message: expect.stringContaining("indisponível") });
  });
  it("resposta inválida não aparece como feed vazio", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "unexpected" })));
    expect(await requestFeed()).toMatchObject({ kind: "error" });
  });
  it("preserva cancelamento ao sair da tela", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")));
    await expect(requestFeed(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
