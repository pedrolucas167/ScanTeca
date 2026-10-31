import { consumeOracleEvents } from "@/lib/oracle-stream";
import type { OracleStage } from "@/lib/constants/oracle";
import type { OracleStreamEvent } from "@/lib/types/oracle";
import { createOracleMetrics, logOracleMetrics, type OracleOutcome } from "./metrics";

export interface OraclePipelineContext {
  signal: AbortSignal;
  stage: (stage: OracleStage) => void;
  metrics: ReturnType<typeof createOracleMetrics>;
  defer: (job: () => Promise<void>) => void;
  reject: () => void;
}

/** Starts progress before retrieval; only a completed inner stream can finish successfully. */
export function createOraclePipeline({ signal: requestSignal, run, schedule, initialEvents = [], timeoutMs = 60_000 }: {
  signal: AbortSignal;
  run: (context: OraclePipelineContext) => Promise<Response>;
  schedule: (job: () => Promise<void>) => void;
  timeoutMs?: number;
  initialEvents?: OracleStreamEvent[];
}) {
  const cancelled = new AbortController();
  const signal = AbortSignal.any([requestSignal, cancelled.signal, AbortSignal.timeout(timeoutMs)]);
  const metrics = createOracleMetrics();
  const jobs: (() => Promise<void>)[] = [];
  const completion = Promise.withResolvers<boolean>();
  let closed = false;
  let rejected = false;
  // Registered within the HTTP request scope; Next runs this only after the response finishes.
  schedule(async () => {
    if (!await completion.promise) return;
    for (const job of jobs) {
      try { await job(); } catch { console.error("[oracle] Falha na tarefa opcional após a resposta."); }
    }
  });
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: OracleStreamEvent | { error: string }) => {
        signal.throwIfAborted();
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      let outcome: OracleOutcome = "failed";
      try {
        for (const event of initialEvents) emit(event);
        emit({ stage: "context" });
        const task = run({ signal, metrics, stage: stage => emit({ stage }),
          defer: job => jobs.push(job), reject: () => { rejected = true; } });
        void task.then(response => { if (signal.aborted) void response.body?.cancel().catch(() => undefined); }).catch(() => undefined);
        let abort!: () => void;
        const interrupted = new Promise<never>((_resolve, reject) => {
          abort = () => reject(signal.reason);
          if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
        });
        let response: Response;
        try { response = await Promise.race([task, interrupted]); }
        finally { signal.removeEventListener("abort", abort); }
        signal.throwIfAborted();
        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined);
          throw new Error("Oracle pipeline failed");
        }
        await consumeOracleEvents<OracleStreamEvent>(response.body, emit, signal);
        signal.throwIfAborted();
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        closed = true;
        controller.close();
        outcome = rejected ? "rejected" : "completed";
        completion.resolve(!rejected);
      } catch {
        outcome = cancelled.signal.aborted || requestSignal.aborted ? "cancelled" : "failed";
        if (!closed) {
          // A timeout is a visible failure; an explicitly cancelled response needs no more events.
          if (outcome !== "cancelled") controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Não foi possível concluir a resposta. Tente novamente." })}\n\n`));
          closed = true;
          controller.close();
        }
        completion.resolve(false);
      } finally { logOracleMetrics(metrics.snapshot(outcome)); }
    },
    cancel(reason) {
      closed = true;
      cancelled.abort(reason);
      completion.resolve(false);
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
