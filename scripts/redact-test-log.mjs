export function redactTestLog(line) {
  return line
    .replace(/([?&](?:__clerk_db_jwt|__clerk_testing_token|__clerk_ticket|token)=)[^\s&#)]+/giu, "$1[REDACTED]")
    .replace(/\bsk_(?:test|live)_[\w-]+/gu, "[REDACTED_SECRET]")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/gu, "[REDACTED_JWT]");
}
