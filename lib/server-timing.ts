type Stage = "middleware.auth" | "page.auth" | "layout.auth" | "layout.accent" | "db.accent" | "catalog.books" | "catalog.settings";

// Opt-in diagnostics: only stage, duration and outcome; never identifiers,
// SQL, parameters, book contents, headers or exception messages.
export async function measureServerTask<T>(stage: Stage, task: () => T | PromiseLike<T>): Promise<T> {
  if (process.env.PERFORMANCE_DIAGNOSTICS !== "1") return task();
  const started = performance.now();
  let outcome = "ok";
  try {
    return await task();
  } catch (error) {
    outcome = "error";
    throw error;
  } finally {
    // eslint-disable-next-line no-console -- Explicitly enabled numeric diagnostics.
    console.info("performance-stage", { stage, durationMs: Math.round((performance.now() - started) * 100) / 100, outcome });
  }
}
