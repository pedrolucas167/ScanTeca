import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const { auth, currentUser, exportAccountData } = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  exportAccountData: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth, currentUser }));
vi.mock("@/lib/privacy-export", () => ({ exportAccountData }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: async () => null }));

const url = "https://scanteca.example/api/privacy/export";

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "user_a" });
  currentUser.mockReset().mockResolvedValue({
    id: "user_a", firstName: "Conta de teste", emailAddresses: [], phoneNumbers: [],
    createdAt: 0, privateMetadata: { internal: "private-fixture" },
  });
  exportAccountData.mockReset().mockResolvedValue({ conversasOraculo: [{ title: "Conversa de teste" }] });
});

it("rejeita visitantes, IDs fornecidos pelo cliente e uma conta Clerk divergente", async () => {
  auth.mockResolvedValueOnce({ userId: null });
  expect((await GET(new NextRequest(url))).status).toBe(401);
  expect((await GET(new NextRequest(`${url}?userId=user_b`))).status).toBe(400);
  currentUser.mockResolvedValueOnce({ id: "user_b" });
  expect((await GET(new NextRequest(url))).status).toBe(401);
  expect(exportAccountData).not.toHaveBeenCalled();
});

it("entrega um anexo privado restrito à conta da sessão", async () => {
  const response = await GET(new NextRequest(url));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-disposition")).toContain("attachment;");
  expect(exportAccountData).toHaveBeenCalledWith("user_a");
  const body = await response.text();
  expect(body).not.toContain("private-fixture");
  expect(JSON.parse(body)).toMatchObject({ conta: { id: "user_a" }, dados: { conversasOraculo: [{ title: "Conversa de teste" }] } });
});

it("reprova a exportação incompleta sem retornar detalhes internos", async () => {
  exportAccountData.mockRejectedValueOnce(new Error("internal-fixture"));
  const response = await GET(new NextRequest(url));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("internal-fixture");
});
