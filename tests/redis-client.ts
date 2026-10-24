import { createConnection } from "node:net";
import type { Redis } from "@upstash/redis";

// Adaptador RESP para executar os scripts reais sem depender do serviço Upstash.
// A porta é exclusiva dos testes; nunca lê credenciais ou URLs de produção.
export function localRedis() {
  if (process.env.SCANTECA_TEST_REDIS !== "127.0.0.1:56379") {
    throw new Error("Defina SCANTECA_TEST_REDIS=127.0.0.1:56379 (Redis isolado de testes).");
  }
  async function command(...args: (string | number)[]): Promise<unknown> {
    const parts = args.map(value => Buffer.from(String(value)));
    const request = Buffer.concat([Buffer.from(`*${parts.length}\r\n`), ...parts.flatMap(part => [Buffer.from(`$${part.length}\r\n`), part, Buffer.from("\r\n")])]);
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: "127.0.0.1", port: 56379 });
      let buffer = Buffer.alloc(0);
      socket.setTimeout(5000, () => socket.destroy(new Error("Redis test timeout")));
      socket.on("error", reject);
      socket.on("connect", () => socket.write(request));
      socket.on("data", chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        try {
          const parsed = parse(buffer, 0);
          if (!parsed) return;
          socket.end();
          if (parsed.value instanceof Error) reject(parsed.value);
          else resolve(parsed.value);
        } catch (error) { socket.destroy(); reject(error); }
      });
    });
  }
  return {
    command,
    client: {
      eval: (script: string, keys: string[], args: (string | number)[]) => command("EVAL", script, keys.length, ...keys, ...args),
      zadd: (key: string, entry: { score: number; member: string }) => command("ZADD", key, entry.score, entry.member),
      hget: (key: string, field: string) => command("HGET", key, field),
      zcard: (key: string) => command("ZCARD", key),
      hlen: (key: string) => command("HLEN", key),
    } as unknown as Redis,
  };
}

function parse(buffer: Buffer, offset: number): { value: unknown; end: number } | null {
  const lineEnd = buffer.indexOf("\r\n", offset);
  if (lineEnd < 0) return null;
  const type = String.fromCharCode(buffer[offset]!);
  const line = buffer.toString("utf8", offset + 1, lineEnd);
  let end = lineEnd + 2;
  if (type === "+") return { value: line, end };
  if (type === "-") return { value: new Error(line), end };
  if (type === ":") return { value: Number(line), end };
  const size = Number(line);
  if (size === -1) return { value: null, end };
  if (type === "$") {
    if (buffer.length < end + size + 2) return null;
    return { value: buffer.toString("utf8", end, end + size), end: end + size + 2 };
  }
  if (type !== "*") throw new Error("Unsupported RESP response");
  const value: unknown[] = [];
  for (let index = 0; index < size; index++) {
    const child = parse(buffer, end);
    if (!child) return null;
    value.push(child.value);
    end = child.end;
  }
  return { value, end };
}
