import { describe, expect, it, vi } from "vitest";
import { consumeOracleEvents } from "./oracle-stream";

function stream(text: string) {
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (const byte of new TextEncoder().encode(text)) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } });
}

describe("Oracle application stream", () => {
  it("reassembles UTF-8, CRLF frames and a final marker without newline", async () => {
    const event = vi.fn();
    await consumeOracleEvents(stream(': comment\r\ndata: {"text":"Olá"}\r\n\r\ndata: [DONE]'), event);
    expect(event).toHaveBeenCalledExactlyOnceWith({ text: "Olá" });
  });
  it.each([
    ['data: {"text":"parcial"}\n', "interrompida"],
    ['data: {broken}\ndata: [DONE]', "ler a resposta"],
    ['data: []\ndata: [DONE]', "inválida"],
    ['data: {"error":"Tente novamente"}\ndata: [DONE]', "Tente novamente"],
  ])("rejects incomplete or invalid responses: %s", async (body, message) => {
    await expect(consumeOracleEvents(stream(body), vi.fn())).rejects.toThrow(message);
  });
  it("rejects a missing response body", async () => {
    await expect(consumeOracleEvents(null, vi.fn())).rejects.toThrow("não retornou");
  });
  it("cancels a pending read and releases its lock when aborted", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const controller = new AbortController();
    const result = consumeOracleEvents(body, vi.fn(), controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });
});
