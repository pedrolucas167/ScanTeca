// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn(), mark: vi.fn() }));
vi.mock("./notification-requests", () => ({ loadNotifications: mocks.load, markNotificationsRead: mocks.mark }));
vi.mock("@/lib/push-client", () => ({ PUSH_CHANGED_EVENT: "test-push", pushSupported: () => false, getSwRegistration: vi.fn(), subscribeToPush: vi.fn(), unsubscribeFromPush: vi.fn() }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
import UnifiedNotifications from "./UnifiedNotifications";

const data = { unreadCount: 1, notifications: [{ id: "test", message: "Uma novidade", url: "/feed", readAt: null, createdAt: "2026-01-01T00:00:00Z" }] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.load.mockResolvedValue(data);
  mocks.mark.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("notificações", () => {
  it("distingue falha de lista vazia e permite nova tentativa", async () => {
    const user = userEvent.setup();
    mocks.load.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ notifications: [], unreadCount: 0 });
    render(<UnifiedNotifications />);
    await user.click(screen.getByRole("button", { name: "Notificações" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Não foi possível carregar as notificações.");
    expect(screen.queryByText(/Nenhuma novidade/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText(/Nenhuma novidade/)).toBeTruthy();
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });

  it("confirma leitura, mantém painel aberto e devolve foco ao sino", async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    mocks.mark.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    render(<UnifiedNotifications />);
    const trigger = await screen.findByRole("button", { name: "Notificações, 1 não lidas" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Marcar todas como lidas" }));
    expect(screen.getByRole("button", { name: "Salvando..." })).toHaveProperty("disabled", true);
    await act(async () => resolve());
    await waitFor(() => expect(trigger.getAttribute("aria-label")).toBe("Notificações"));
    expect(screen.getByRole("region", { name: "Notificações" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Todas as notificações foram marcadas como lidas.");
    expect(document.activeElement).toBe(trigger);
  });

  it("não confirma leitura quando a gravação falha", async () => {
    const user = userEvent.setup();
    mocks.mark.mockRejectedValue(new Error("offline"));
    render(<UnifiedNotifications />);
    const trigger = await screen.findByRole("button", { name: "Notificações, 1 não lidas" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Marcar todas como lidas" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Não foi possível marcar as notificações como lidas. Tente novamente.");
    expect(trigger.getAttribute("aria-label")).toBe("Notificações, 1 não lidas");
    expect(screen.queryByText("Todas as notificações foram marcadas como lidas.")).toBeNull();
  });

  it("fecha com Escape e também ao sair por Tab", async () => {
    const user = userEvent.setup();
    render(<><UnifiedNotifications /><button>Fora do painel</button></>);
    const trigger = await screen.findByRole("button", { name: "Notificações, 1 não lidas" });
    await user.click(trigger);
    await user.tab();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fora do painel" }));
    expect(screen.queryByRole("region")).toBeNull();
  });
});
