import { beforeEach, expect, it, vi } from "vitest";
import { acceptTerms } from "./actions";
import { termsVersion } from "./version";

const { auth, createMany, revalidatePath } = vi.hoisted(() => ({
  auth: vi.fn(),
  createMany: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { termsAcceptance: { createMany } } }));
vi.mock("next/cache", () => ({ revalidatePath }));

function agreement(version = termsVersion, accepted = true) {
  const form = new FormData();
  form.set("version", version);
  form.set("userId", "other-account");
  if (accepted) form.set("agreement", "accepted");
  return form;
}

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "authenticated-account" });
  createMany.mockReset().mockResolvedValue({ count: 1 });
  revalidatePath.mockReset();
});

it("exige sessão, confirmação explícita e a versão atual", async () => {
  auth.mockResolvedValueOnce({ userId: null });
  expect((await acceptTerms({ error: "" }, agreement())).error).toBeTruthy();
  expect((await acceptTerms({ error: "" }, agreement("old-version"))).error).toBeTruthy();
  expect((await acceptTerms({ error: "" }, agreement(termsVersion, false))).error).toBeTruthy();
  expect(createMany).not.toHaveBeenCalled();
});

it("grava o aceite na conta da sessão e permite reenvio sem sobrescrever o registro", async () => {
  createMany.mockResolvedValueOnce({ count: 0 });
  expect(await acceptTerms({ error: "" }, agreement())).toEqual({ error: "" });
  expect(createMany).toHaveBeenCalledWith({
    data: [{ userId: "authenticated-account", version: termsVersion }],
    skipDuplicates: true,
  });
  expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
});

it("retorna erro recuperável quando o banco não confirma a gravação", async () => {
  createMany.mockRejectedValueOnce(new Error("offline"));
  expect((await acceptTerms({ error: "" }, agreement())).error).toBeTruthy();
  expect(revalidatePath).not.toHaveBeenCalled();
});
