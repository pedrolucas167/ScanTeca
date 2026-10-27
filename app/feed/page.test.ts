import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), useAuth: vi.fn(() => ({ isLoaded: true })) }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@clerk/nextjs", () => ({
  useAuth: mocks.useAuth,
  SignInButton: ({ children }: { children: ReactNode }) => children,
  SignUpButton: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./FeedClient", () => ({ default: () => createElement("div", null, "Feed autenticado") }));
import FeedPage from "./page";
afterEach(() => vi.clearAllMocks());
describe("entrada do feed", () => {
  it("visitante recebe convite de entrada, sem compositor ou falso erro técnico", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const html = renderToStaticMarkup(await FeedPage());
    expect(html).toContain("Entre para participar do feed");
    expect(html).toContain("Entrar no feed");
    expect(html).toContain("Criar conta");
    expect(html).not.toContain("Feed autenticado");
    expect(html).not.toContain("Não foi possível");
  });
  it("sessão autenticada continua recebendo o feed", async () => {
    mocks.auth.mockResolvedValue({ userId: "test-user" });
    const html = renderToStaticMarkup(await FeedPage());
    expect(html).toContain("Feed autenticado");
    expect(html).not.toContain("Entre para participar");
  });
  it.each([false, true])("só libera os botões após carregar autenticação: %s", async isLoaded => {
    mocks.auth.mockResolvedValue({ userId: null });
    mocks.useAuth.mockReturnValueOnce({ isLoaded });
    const html = renderToStaticMarkup(await FeedPage());
    expect((html.match(/disabled=""/gu) || []).length).toBe(isLoaded ? 0 : 2);
  });
});
