/** Consome eventos da aplicação, exigindo conclusão explícita e liberando o reader. */
export async function consumeOracleEvents<T>(body: ReadableStream<Uint8Array> | null, onEvent: (event: T) => void, signal?: AbortSignal) {
  if (!body) throw new Error("O Oráculo não retornou uma resposta.");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  const abort = () => { void reader.cancel(signal?.reason).catch(() => undefined); };
  signal?.addEventListener("abort", abort, { once: true });
  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload) return;
    if (payload === "[DONE]") { completed = true; return; }
    let event: unknown;
    try { event = JSON.parse(payload); } catch { throw new Error("Não foi possível ler a resposta do Oráculo."); }
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("O Oráculo retornou uma resposta inválida.");
    if ("error" in event && event.error) throw new Error(typeof event.error === "string" ? event.error : "Não foi possível concluir a resposta.");
    onEvent(event as T);
  };
  try {
    signal?.throwIfAborted();
    while (!completed) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) { consume(line.trim()); if (completed) break; }
      if (done) { if (buffer.trim() && !completed) consume(buffer.trim()); break; }
    }
    if (!completed) throw new Error("A resposta foi interrompida. Tente novamente.");
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
