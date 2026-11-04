// Loaded only by the Playwright server, never imported by application code.
export const oracleFixtureKey = "scanteca-e2e-oracle-local-only";

export function createOracleProviderFixture(environment) {
  if (environment.E2E_ORACLE_FIXTURES !== "1") return null;
  const database = new URL(environment.DATABASE_URL || "file:missing");
  if (database.hostname !== "127.0.0.1" || database.port !== "55439"
    || database.pathname !== "/scanteca_reading_test" || database.search
    || environment.OPENROUTER_API_KEY !== oracleFixtureKey) {
    throw new Error("Oracle fixtures require the disposable local database and a dummy provider key.");
  }
  const attempts = new Map();
  return async (url, init) => {
    // No OpenRouter request can fall through to the real provider in this mode.
    if (url.pathname.endsWith("/embeddings")) return Response.json({ data: [] });
    if (!url.pathname.endsWith("/chat/completions")) return new Response(null, { status: 503 });
    const body = JSON.parse(init?.body || "{}");
    const content = body.messages?.at(-1)?.content || "";
    if (body.messages?.[0]?.content?.includes("moderador de conteúdo")) {
      return Response.json({ choices: [{ message: { content: JSON.stringify({ approved: true, flagged: false }) } }] });
    }
    if (!body.stream) {
      const question = content.split("Última pergunta do leitor: ").at(-1);
      return Response.json({ choices: [{ message: { content: question } }] });
    }
    const question = content.split("Pergunta do usuário: ").at(-1);
    const attempt = (attempts.get(question) || 0) + 1;
    attempts.set(question, attempt);
    if (question.includes("[falha-dupla]") && attempt <= 2) return new Response(null, { status: 503 });
    const answer = `A obra recuperada aborda memória e cidade, conforme a sinopse fornecida [1]. Resposta de teste ${attempt}.`;
    const encoder = new TextEncoder();
    let timer;
    let finished = false;
    let abort;
    const stream = new ReadableStream({
      start(controller) {
        const finish = () => {
          if (finished) return;
          finished = true;
          init?.signal?.removeEventListener("abort", abort);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: answer }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`));
          controller.close();
        };
        abort = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          controller.error(new DOMException("Cancelled", "AbortError"));
        };
        if (init?.signal?.aborted) return abort();
        init?.signal?.addEventListener("abort", abort, { once: true });
        if (question.includes("[cancelar]")) timer = setTimeout(finish, 10_000);
        else finish();
      },
      cancel() {
        finished = true;
        clearTimeout(timer);
        init?.signal?.removeEventListener("abort", abort);
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  };
}
