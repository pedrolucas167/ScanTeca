export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
export const CHAT_MODEL = process.env.ORACLE_CHAT_MODEL || "google/gemini-2.5-flash";
export const MAX_TOKENS_CHAT = Number(process.env.ORACLE_MAX_TOKENS || 800);
export const MAX_TOKENS_REWRITE = 60;
