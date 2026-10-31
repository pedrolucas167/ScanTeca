import { describe, expect, it, vi } from "vitest";
import { createOraclePipeline } from "./pipeline";

const response = () => new Response('data: {"text":"Resposta já conferida."}\n\ndata: [DONE]\n\n');

describe("Oracle pipeline transport", () => {
  it("delivers progress before a slow retrieval has finished", async () => {
    const gate = Promise.withResolvers<void>();
    const value = createOraclePipeline({ signal: new AbortController().signal, schedule: vi.fn(), run: async context => {
      await gate.promise;
      context.stage("generation");
      return response();
    } });
    const reader = value.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain('"stage":"context"');
    gate.resolve();
    let rest = "";
    while (true) { const chunk = await reader.read(); if (chunk.done) break; rest += new TextDecoder().decode(chunk.value); }
    expect(rest).toContain('"stage":"generation"');
    expect(rest).toContain("data: [DONE]");
    reader.releaseLock();
  });
  it("finishes the response without waiting for optional profile learning", async () => {
    const gate = Promise.withResolvers<void>();
    const job = vi.fn(() => gate.promise);
    const schedule = vi.fn();
    const value = createOraclePipeline({ signal: new AbortController().signal, schedule, run: async context => {
      context.defer(job);
      return response();
    } });
    expect(await value.text()).toContain("data: [DONE]");
    expect(job).not.toHaveBeenCalled();
    const deferred = schedule.mock.calls[0]![0]();
    await vi.waitFor(() => expect(job).toHaveBeenCalledOnce());
    gate.resolve();
    await deferred;
  });
  it("does not run optional jobs after rejection", async () => {
    const job = vi.fn();
    const schedule = vi.fn();
    const value = createOraclePipeline({ signal: new AbortController().signal, schedule, run: async context => {
      context.reject();
      context.defer(job);
      return response();
    } });
    await value.text();
    await schedule.mock.calls[0]![0]();
    expect(job).not.toHaveBeenCalled();
  });
  it("aborts a hanging task when the consumer cancels", async () => {
    let signal: AbortSignal | undefined;
    const job = vi.fn();
    const schedule = vi.fn();
    const value = createOraclePipeline({ signal: new AbortController().signal, schedule, run: async context => {
      signal = context.signal;
      context.defer(job);
      return new Promise<Response>(() => {});
    } });
    const reader = value.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(signal?.aborted).toBe(true);
    await schedule.mock.calls[0]![0]();
    expect(job).not.toHaveBeenCalled();
  });
  it("reports timeout even when the underlying database promise never settles", async () => {
    const value = createOraclePipeline({ signal: new AbortController().signal, schedule: vi.fn(), timeoutMs: 10,
      run: async () => new Promise<Response>(() => {}) });
    const body = await value.text();
    expect(body).toContain('"error":');
    expect(body).not.toContain("data: [DONE]");
  });
  it("does not expose provider error bodies or consider them complete", async () => {
    const value = createOraclePipeline({ signal: new AbortController().signal, schedule: vi.fn(),
      run: async () => new Response("private provider detail", { status: 502 }) });
    const body = await value.text();
    expect(body).toContain('"error":');
    expect(body).not.toMatch(/private|\[DONE\]/);
  });
});
