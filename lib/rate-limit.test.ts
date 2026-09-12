import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const getRedisMock = vi.fn();
vi.mock("./redis", () => ({
  getRedis: () => getRedisMock(),
}));

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/test", { headers });
}

async function importGuard() {
  const mod = await import("./rate-limit");
  return mod.rateLimitGuard;
}

const config = { route: "test", userLimit: 2, ipLimit: 3, windowMs: 60_000 };

describe("rateLimitGuard — memory store", () => {
  beforeEach(() => {
    vi.resetModules();
    getRedisMock.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna null quando abaixo dos limites", async () => {
    const guard = await importGuard();
    const res = await guard(makeRequest(), { ...config, userId: "u1" });
    expect(res).toBeNull();
  });

  it("retorna 429 quando o limite de IP é excedido", async () => {
    const guard = await importGuard();
    const req = () => makeRequest({ "x-forwarded-for": "1.2.3.4" });

    await guard(req(), config);
    await guard(req(), config);
    await guard(req(), config);
    const res = await guard(req(), config);

    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBeTruthy();
    expect(res?.headers.get("X-RateLimit-Limit")).toBe("3");
  });

  it("retorna 429 quando o limite de usuário é excedido", async () => {
    const guard = await importGuard();
    const req = () => makeRequest({ "x-forwarded-for": "1.2.3.4" });
    const opts = { ...config, userId: "u1", ipLimit: 100 };

    await guard(req(), opts);
    await guard(req(), opts);
    const res = await guard(req(), opts);

    expect(res?.status).toBe(429);
  });

  it("não aplica limite de usuário sem userId", async () => {
    const guard = await importGuard();
    const req = () => makeRequest({ "x-forwarded-for": "1.2.3.4" });
    const opts = { ...config, userLimit: 1, ipLimit: 100 };

    await guard(req(), opts);
    const res = await guard(req(), opts);

    expect(res).toBeNull();
  });

  it("isola contadores por IP", async () => {
    const guard = await importGuard();
    const opts = { ...config, ipLimit: 1 };

    const a1 = await guard(makeRequest({ "x-forwarded-for": "1.1.1.1" }), opts);
    const b1 = await guard(makeRequest({ "x-forwarded-for": "2.2.2.2" }), opts);
    const a2 = await guard(makeRequest({ "x-forwarded-for": "1.1.1.1" }), opts);

    expect(a1).toBeNull();
    expect(b1).toBeNull();
    expect(a2?.status).toBe(429);
  });

  it("prefere cf-connecting-ip a x-forwarded-for", async () => {
    const guard = await importGuard();
    const opts = { ...config, ipLimit: 1 };
    const req = () =>
      makeRequest({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" });

    await guard(req(), opts);
    // Mesmo cf-connecting-ip → mesmo bucket → estoura
    const res = await guard(req(), opts);
    expect(res?.status).toBe(429);
    // x-forwarded-for igual mas cf diferente → bucket diferente → passa
    const other = await guard(
      makeRequest({ "cf-connecting-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1" }),
      opts
    );
    expect(other).toBeNull();
  });

  it("reseta o contador após a janela", async () => {
    vi.useFakeTimers();
    const guard = await importGuard();
    const opts = { ...config, ipLimit: 1, windowMs: 10_000 };
    const req = () => makeRequest({ "x-forwarded-for": "1.2.3.4" });

    await guard(req(), opts);
    const blocked = await guard(req(), opts);
    expect(blocked?.status).toBe(429);

    vi.setSystemTime(Date.now() + 10_001);
    const after = await guard(req(), opts);
    expect(after).toBeNull();
  });
});

describe("rateLimitGuard — redis store", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("usa INCR+PEXPIRE atômico com prefixo rate: e retorna 429 acima do limite", async () => {
    const evalMock = vi.fn().mockResolvedValue([5, 30_000]);
    getRedisMock.mockReturnValue({ eval: evalMock });

    const guard = await importGuard();
    const res = await guard(makeRequest(), {
      route: "test",
      userId: "u1",
      userLimit: 3,
      ipLimit: 10,
      windowMs: 60_000,
    });

    // IP check passa (count 5 <= ipLimit 10), user check estoura (5 > 3)
    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining("INCR"),
      ["rate:ip:unknown:test"],
      [60_000]
    );
    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String),
      ["rate:user:u1:test"],
      [60_000]
    );
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("30");
  });
});
