import { afterEach, describe, expect, it, vi } from "vitest";
import { loadNotifications, markNotificationsRead } from "./notification-requests";

afterEach(() => vi.unstubAllGlobals());

describe("notificações: estados de rede", () => {
  it("lista vazia é um carregamento válido", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ notifications: [], unreadCount: 0 })));
    expect(await loadNotifications()).toEqual({ notifications: [], unreadCount: 0 });
  });

  it.each([401, 500, 503])("não confunde HTTP %s com lista vazia", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
    await expect(loadNotifications()).rejects.toThrow("carregar");
  });

  it("permite carregar novamente após falha de conexão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(Response.json({ notifications: [], unreadCount: 0 })));
    await expect(loadNotifications()).rejects.toThrow();
    expect((await loadNotifications()).notifications).toEqual([]);
  });

  it("rejeita uma resposta malformada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ notifications: null, unreadCount: -1 })));
    await expect(loadNotifications()).rejects.toThrow("carregar");
  });

  it("mantém o cancelamento ao desmontar o painel", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadNotifications(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications", { signal: controller.signal });
  });

  it("não confirma leitura quando a gravação é rejeitada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(markNotificationsRead("notificacao")).rejects.toThrow("marcar");
  });

  it("confirma leitura individual e em lote após sucesso", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(markNotificationsRead("notificacao")).resolves.toBeUndefined();
    await expect(markNotificationsRead()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/notifications", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ id: "notificacao" }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/notifications", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({}),
    }));
  });
});
