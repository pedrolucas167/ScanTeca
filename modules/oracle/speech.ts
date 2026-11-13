const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const TTS_INSTRUCTIONS =
  process.env.ORACLE_TTS_INSTRUCTIONS ||
  "Fale como J.A.R.V.I.S., o assistente do Homem de Ferro: calmo, sofisticado, levemente britânico, eficiente e leal.";
const TTS_CANDIDATES: { model: string; voice: string }[] = [
  ...(process.env.ORACLE_TTS_MODEL
    ? [
        {
          model: process.env.ORACLE_TTS_MODEL,
          voice: process.env.ORACLE_TTS_VOICE || "pm_alex",
        },
      ]
    : []),
  { model: "hexgrad/kokoro-82m", voice: "pm_alex" },
  { model: "hexgrad/kokoro-82m", voice: "pf_dora" },
  { model: "mistralai/voxtral-mini-tts-2603", voice: "en_paul_neutral" },
];

type OracleSpeechResult =
  | { ok: true; body: ReadableStream<Uint8Array> }
  | { ok: false; lastError: string };

export async function generateOracleSpeech(text: string, apiKey: string): Promise<OracleSpeechResult> {
  const trimmedText = text.trim().slice(0, 1500);
  let lastError = "";

  for (const candidate of TTS_CANDIDATES) {
    const res = await fetch(`${OPENROUTER_BASE}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Scanteca Oráculo",
      },
      body: JSON.stringify({
        model: candidate.model,
        input: trimmedText,
        voice: candidate.voice,
        response_format: "mp3",
        ...(TTS_INSTRUCTIONS
          ? {
              provider: {
                options: {
                  openai: { instructions: TTS_INSTRUCTIONS },
                },
              },
            }
          : {}),
      }),
    });

    if (res.ok && res.body) {
      return { ok: true, body: res.body };
    }
    lastError = await res.text();
    console.error(
      "[oracle] TTS error:",
      res.status,
      candidate.model,
      candidate.voice,
      lastError
    );
  }

  return { ok: false, lastError };
}
