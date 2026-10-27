import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configure: vi.fn(), send: vi.fn(), subscriptions: vi.fn(), preferences: vi.fn(),
  remove: vi.fn(), goal: vi.fn(),
}));
vi.mock("web-push", () => ({ default: { setVapidDetails: mocks.configure, sendNotification: mocks.send } }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  pushSubscription: { findMany: mocks.subscriptions, deleteMany: mocks.remove },
  notificationPreference: { findMany: mocks.preferences },
} }));
vi.mock("@/modules/reading", () => ({ getAnnualGoalStatus: mocks.goal }));

const subscription = (id: string, userId = id) => ({ id, userId, endpoint: `https://push.example.test/${id}`, p256dh: "test", auth: "test" });
const payload = { title: "Teste", body: "Notificação controlada" };

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "");
  mocks.subscriptions.mockResolvedValue([]);
  mocks.preferences.mockResolvedValue([]);
  mocks.remove.mockResolvedValue({ count: 0 });
  mocks.send.mockResolvedValue({});
});
afterEach(() => vi.unstubAllEnvs());

function configureFixtures() {
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public-test-fixture");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private-test-fixture");
}

describe("Web Push isolado", () => {
  it("sem credenciais não configura transporte nem consulta inscrições", async () => {
    const push = await import("./push");
    expect(push.pushConfigured()).toBe(false);
    expect(await push.sendPush(payload)).toEqual({ sent: 0, failed: 0, removed: 0 });
    expect(mocks.configure).not.toHaveBeenCalled();
    expect(mocks.subscriptions).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("configura uma única vez e não tenta enviar quando não há inscrições", async () => {
    configureFixtures();
    const push = await import("./push");
    expect(push.pushConfigured()).toBe(true);
    expect(push.pushConfigured()).toBe(true);
    expect(await push.sendPush(payload)).toEqual({ sent: 0, failed: 0, removed: 0 });
    expect(mocks.configure).toHaveBeenCalledTimes(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("respeita o opt-out de categoria antes de enviar", async () => {
    configureFixtures();
    mocks.subscriptions.mockResolvedValue([subscription("a"), subscription("b")]);
    mocks.preferences.mockResolvedValue([{ userId: "b" }]);
    const { sendPush } = await import("./push");
    expect(await sendPush(payload, { category: "reviews" })).toEqual({ sent: 1, failed: 0, removed: 0 });
    expect(mocks.preferences).toHaveBeenCalledWith({ where: { userId: { in: ["a", "b"] }, reviews: false }, select: { userId: true } });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0]?.[0].endpoint).toBe("https://push.example.test/a");
  });

  it("distingue endpoints expirados de falha de transporte e limita a consulta ao usuário", async () => {
    configureFixtures();
    mocks.subscriptions.mockResolvedValue(["ok", "gone", "expired", "failure"].map(id => subscription(id, "reader")));
    mocks.send.mockImplementation(async ({ endpoint }: { endpoint: string }) => {
      if (endpoint.endsWith("/gone")) throw { statusCode: 404 };
      if (endpoint.endsWith("/expired")) throw { statusCode: 410 };
      if (endpoint.endsWith("/failure")) throw { statusCode: 500 };
      return {};
    });
    const { sendPush } = await import("./push");
    expect(await sendPush(payload, { userId: "reader" })).toEqual({ sent: 1, failed: 1, removed: 2 });
    expect(mocks.subscriptions).toHaveBeenCalledWith({ where: { userId: "reader" } });
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: { in: ["gone", "expired"] } } });
  });

  it("não envia aviso de meta quando ainda não foi atingida", async () => {
    mocks.goal.mockResolvedValue({ completed: 1, target: 2 });
    const { notifyGoalIfReached } = await import("./push");
    await notifyGoalIfReached("reader");
    expect(mocks.subscriptions).not.toHaveBeenCalled();
  });

  it("envia aviso de meta atingida pela categoria de progresso", async () => {
    configureFixtures();
    mocks.goal.mockResolvedValue({ completed: 2, target: 2 });
    mocks.subscriptions.mockResolvedValue([subscription("a", "reader")]);
    const { notifyGoalIfReached } = await import("./push");
    await notifyGoalIfReached("reader");
    expect(mocks.preferences).toHaveBeenCalledWith({ where: { userId: { in: ["reader"] }, progress: false }, select: { userId: true } });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mocks.send.mock.calls[0]?.[1])).toMatchObject({ title: "Meta batida! 🎉", url: "/jornada" });
  });
});
