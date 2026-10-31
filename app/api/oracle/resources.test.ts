import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: vi.fn(), rateLimits: {
  "oracle/sessions": { userLimit: 60, ipLimit: 120, windowMs: 60000 },
  "oracle/artifacts": { userLimit: 60, ipLimit: 120, windowMs: 60000 },
} }));
vi.mock("@/modules/oracle", async original => ({ ...await original<typeof import("@/modules/oracle")>(),
  listOracleSessions: vi.fn(), createOracleSession: vi.fn(), findOracleSession: vi.fn(),
  updateOracleSession: vi.fn(), deleteOracleSession: vi.fn(), listOracleArtifacts: vi.fn(), saveOracleArtifact: vi.fn(),
}));
import { auth } from "@clerk/nextjs/server";
import { rateLimitGuard } from "@/lib/rate-limit";
import * as oracle from "@/modules/oracle";
import * as sessions from "./sessions/route";
import * as session from "./sessions/[id]/route";
import * as artifacts from "./artifacts/route";

const id = "cm123456789012345678901234";
const context = () => ({ params: Promise.resolve({ id }) });
const request = (method = "POST", body: unknown = {}) => new NextRequest("http://localhost/api/oracle/sessions", {
  method, ...(method !== "GET" && method !== "DELETE" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "owner" } as Awaited<ReturnType<typeof auth>>);
  vi.mocked(rateLimitGuard).mockResolvedValue(null);
  vi.mocked(oracle.listOracleSessions).mockResolvedValue([]);
  vi.mocked(oracle.listOracleArtifacts).mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("Oracle resource HTTP boundaries", () => {
  it.each([
    ["list sessions", () => sessions.GET()], ["create session", () => sessions.POST(request())],
    ["get session", () => session.GET(request("GET"), context())],
    ["update session", () => session.PATCH(request("PATCH"), context())],
    ["delete session", () => session.DELETE(request("DELETE"), context())],
    ["list artifacts", () => artifacts.GET()], ["save artifact", () => artifacts.POST(request())],
  ] as const)("rejects unauthenticated %s before domain work", async (_name, call) => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as Awaited<ReturnType<typeof auth>>);
    expect((await call()).status).toBe(401);
    for (const method of [oracle.listOracleSessions, oracle.createOracleSession, oracle.findOracleSession,
      oracle.updateOracleSession, oracle.deleteOracleSession, oracle.listOracleArtifacts, oracle.saveOracleArtifact]) {
      expect(method).not.toHaveBeenCalled();
    }
  });
  it("uses only the authenticated owner when creating a session", async () => {
    vi.mocked(oracle.createOracleSession).mockResolvedValueOnce({ id } as never);
    expect((await sessions.POST(request("POST", { title: " Minha conversa ", userId: "intruder" }))).status).toBe(201);
    expect(oracle.createOracleSession).toHaveBeenCalledWith("owner", { title: "Minha conversa", mode: "EXPLORE" });
    expect(rateLimitGuard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userLimit: 60, ipLimit: 120 }));
  });
  it("uses the artifact route's configured limits and strips forged ownership", async () => {
    vi.mocked(oracle.saveOracleArtifact).mockResolvedValueOnce({ id } as never);
    expect((await artifacts.POST(request("POST", { type: "NOTE", title: "Nota", content: "Conteúdo", userId: "intruder" }))).status).toBe(201);
    expect(oracle.saveOracleArtifact).toHaveBeenCalledWith("owner", { type: "NOTE", title: "Nota", content: "Conteúdo" });
    expect(rateLimitGuard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ route: "oracle/artifacts", userLimit: 60, ipLimit: 120 }));
  });
  it("does not write after rate limiting or invalid input", async () => {
    vi.mocked(rateLimitGuard).mockResolvedValueOnce(Response.json({ error: "Limite" }, { status: 429 }));
    expect((await sessions.POST(request())).status).toBe(429);
    expect((await artifacts.POST(request("POST", { type: "INVALID" }))).status).toBe(400);
    expect(oracle.createOracleSession).not.toHaveBeenCalled();
    expect(oracle.saveOracleArtifact).not.toHaveBeenCalled();
  });
  it("returns not found for inaccessible session reads, edits and deletions", async () => {
    vi.mocked(oracle.findOracleSession).mockResolvedValueOnce(null);
    vi.mocked(oracle.updateOracleSession).mockResolvedValueOnce(false);
    vi.mocked(oracle.deleteOracleSession).mockResolvedValueOnce(false);
    expect((await session.GET(request("GET"), context())).status).toBe(404);
    expect((await session.PATCH(request("PATCH", { title: "Outra" }), context())).status).toBe(404);
    expect((await session.DELETE(request("DELETE"), context())).status).toBe(404);
    expect(oracle.findOracleSession).toHaveBeenCalledWith("owner", id);
    expect(oracle.updateOracleSession).toHaveBeenCalledWith("owner", id, { title: "Outra" });
    expect(oracle.deleteOracleSession).toHaveBeenCalledWith("owner", id);
  });
  it("maps an artifact ownership failure without exposing database errors", async () => {
    vi.mocked(oracle.saveOracleArtifact).mockRejectedValueOnce(new oracle.OracleSessionError("NOT_FOUND"));
    expect((await artifacts.POST(request("POST", { type: "NOTE", title: "Nota", content: "Texto", sessionId: id }))).status).toBe(404);
  });
  it("sanitizes an unexpected database failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(oracle.listOracleSessions).mockRejectedValueOnce(new Error("fixture-private-database-error"));
    const response = await sessions.GET();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("fixture-private");
    expect(error).toHaveBeenCalledExactlyOnceWith("[oracle] sessions GET failed");
  });
});
