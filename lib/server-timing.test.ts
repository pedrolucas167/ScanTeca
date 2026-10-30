import { afterEach, expect, it, vi } from "vitest";
import { measureServerTask } from "./server-timing";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it("não registra dados quando o diagnóstico está desligado", async () => {
  vi.stubEnv("PERFORMANCE_DIAGNOSTICS", "0");
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const result = { notes: "private", userId: "private" };
  expect(await measureServerTask("catalog.books", async () => result)).toBe(result);
  expect(log).not.toHaveBeenCalled();
});

it("registra apenas etapa, tempo e resultado quando habilitado", async () => {
  vi.stubEnv("PERFORMANCE_DIAGNOSTICS", "1");
  vi.spyOn(performance, "now").mockReturnValueOnce(10).mockReturnValueOnce(35.25);
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  await measureServerTask("catalog.books", async () => ({ notes: "private", userId: "private" }));
  expect(log).toHaveBeenCalledWith("performance-stage", { stage: "catalog.books", durationMs: 25.25, outcome: "ok" });
});

it("mantém o erro original sem registrar sua mensagem", async () => {
  vi.stubEnv("PERFORMANCE_DIAGNOSTICS", "1");
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const failure = new Error("private connection string");
  await expect(measureServerTask("catalog.settings", () => Promise.reject(failure))).rejects.toBe(failure);
  expect(log).toHaveBeenCalledWith("performance-stage", expect.objectContaining({ stage: "catalog.settings", outcome: "error" }));
  expect(JSON.stringify(log.mock.calls)).not.toContain("private");
});
