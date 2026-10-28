import { describe, expect, it, vi } from "vitest";
import { readOracleCompletion } from "./completion";

function stream(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) {
    // Split even multibyte UTF-8 characters and SSE frames across chunks.
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } });
}
const answer = 'data: {"choices":[{"delta":{"content":"Olá, leitor"}}]}\n\n';
describe("Oracle provider completion", () => {
  it("reports incremental text while still requiring completion", async () => {
    const onDelta = vi.fn();
    await expect(readOracleCompletion(stream(answer + "data: [DONE]"), { onDelta })).resolves.toBe("Olá, leitor");
    expect(onDelta).toHaveBeenCalledExactlyOnceWith("Olá, leitor");
  });
  it("cancels a pending provider read when the consumer aborts", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const controller = new AbortController();
    const result = readOracleCompletion(body, { signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });
  it("reassembles UTF-8 and accepts an explicit completion marker", async () => {
    await expect(readOracleCompletion(stream(answer + "data: [DONE]"))).resolves.toBe("Olá, leitor");
  });
  it("rejects a clean connection close without a completion marker", async () => {
    await expect(readOracleCompletion(stream(answer))).rejects.toThrow("before completion");
  });
  it("rejects a provider error after partial content", async () => {
    await expect(readOracleCompletion(stream(answer + 'data: {"error":{"message":"failed"}}\n\n'))).rejects.toThrow("rejected");
  });
  it("rejects token truncation even with a completion marker", async () => {
    await expect(readOracleCompletion(stream(answer + 'data: {"choices":[{"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'))).rejects.toThrow("truncated");
  });
  it("rejects broken provider JSON instead of losing part of the answer", async () => {
    await expect(readOracleCompletion(stream('data: {broken}\n\ndata: [DONE]\n\n'))).rejects.toThrow();
  });
});
