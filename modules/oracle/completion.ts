/** Accept a provider answer only after its explicit completion marker. */
export async function readOracleCompletion(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let completed = false;
  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") { completed = true; return; }
    if (!payload) return;
    const event = JSON.parse(payload);
    if (event.error) throw new Error("Oracle provider rejected completion");
    const choice = event.choices?.[0];
    if (choice?.finish_reason && choice.finish_reason !== "stop") {
      throw new Error("Oracle completion was truncated");
    }
    const content = choice?.delta?.content;
    if (typeof content === "string") text += content;
    else if (Array.isArray(content)) {
      for (const part of content) if (typeof part?.text === "string") text += part.text;
    }
  };
  try {
    while (!completed) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) { consume(line.trim()); if (completed) break; }
      if (done) { if (buffer.trim()) consume(buffer.trim()); break; }
    }
    if (!completed) throw new Error("Oracle connection ended before completion");
    return text;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
