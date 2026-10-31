import { parseOracleUsage, type OracleUsage } from "@/lib/oracle-usage";

/** Accept a provider answer only after its explicit completion marker. */
export async function readOracleCompletion(body: ReadableStream<Uint8Array>, options: { signal?: AbortSignal; onDelta?: (text: string) => void; onUsage?: (usage: OracleUsage) => void } = {}): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let completed = false;
  const abort = () => { void reader.cancel(options.signal?.reason).catch(() => undefined); };
  options.signal?.addEventListener("abort", abort, { once: true });
  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") { completed = true; return; }
    if (!payload) return;
    const event = JSON.parse(payload);
    if (event.error) throw new Error("Oracle provider rejected completion");
    const usage = parseOracleUsage(event.usage);
    if (usage) options.onUsage?.(usage);
    const choice = event.choices?.[0];
    if (choice?.finish_reason && choice.finish_reason !== "stop") {
      throw new Error("Oracle completion was truncated");
    }
    const content = choice?.delta?.content;
    if (typeof content === "string") { text += content; options.onDelta?.(content); }
    else if (Array.isArray(content)) {
      for (const part of content) if (typeof part?.text === "string") { text += part.text; options.onDelta?.(part.text); }
    }
  };
  try {
    options.signal?.throwIfAborted();
    while (!completed) {
      const { done, value } = await reader.read();
      options.signal?.throwIfAborted();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) { consume(line.trim()); if (completed) break; }
      if (done) { if (buffer.trim()) consume(buffer.trim()); break; }
    }
    if (!completed) throw new Error("Oracle connection ended before completion");
    return text;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
