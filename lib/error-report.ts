/**
 * Reporte de erros via webhook (Discord/Slack-compatible).
 * Configure ERROR_WEBHOOK_URL no ambiente — sem ela, vira no-op.
 * Fire-and-forget: nunca lança, nunca bloqueia a request.
 */
export function reportError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>
): void {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;

  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const details = extra ? `\n\`\`\`json\n${JSON.stringify(extra, null, 2).slice(0, 1500)}\n\`\`\`` : "";

  // Formato compatível com Discord e Slack Incoming Webhooks.
  const body = JSON.stringify({
    content: `🚨 **${context}**\n\`${message.slice(0, 500)}\`${details}`,
    text: `🚨 ${context}\n${message.slice(0, 500)}`,
  });

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {});
}
