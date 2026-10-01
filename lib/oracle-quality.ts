const GIBBERISH_MARKERS = [
  /\b(?:lorem|ipsum|payload|async|headercode|nonnull|undefined|nullmat|cor\.r\.type)\b/i,
  /[^\p{L}\p{N}\s.,;:!?'"()[\]«»\-—–/%]{5,}/u,
  /(?:[A-Za-zÀ-ÿ]{1,3}[A-ZÀ-Ý]){4,}/,
];

export interface OracleQualityResult {
  valid: boolean;
  reason?: string;
}

export function validateOracleResponse(
  text: string,
  allowedTitles: string[] = []
): OracleQualityResult {
  const normalized = text.trim();
  if (normalized.length < 20) {
    return { valid: false, reason: "resposta curta ou vazia" };
  }

  const suspiciousMarkers = GIBBERISH_MARKERS.filter((pattern) =>
    pattern.test(normalized)
  ).length;
  const letters = (normalized.match(/\p{L}/gu) || []).length;
  const replacementChars = (normalized.match(/\uFFFD/g) || []).length;
  const words = normalized.split(/\s+/).filter(Boolean);
  const longUnbrokenWords = words.filter((word) => word.length > 35).length;

  if (
    replacementChars > 0 ||
    suspiciousMarkers >= 1 ||
    longUnbrokenWords >= 1 ||
    (normalized.length > 300 && letters / normalized.length < 0.55)
  ) {
    return { valid: false, reason: "sinais de degeneração textual" };
  }

  if (allowedTitles.length > 0) {
    const mentionedQuotedTitles = [...normalized.matchAll(/"([^"]{2,120})"/g)]
      .map((match) => match[1].trim().toLocaleLowerCase("pt-BR"));
    const knownTitles = allowedTitles.map((title) =>
      title.trim().toLocaleLowerCase("pt-BR")
    );
    const unknownQuotedTitle = mentionedQuotedTitles.some(
      (title) =>
        !knownTitles.some(
          (known) => title === known || title.includes(known) || known.includes(title)
        )
    );
    if (unknownQuotedTitle) {
      return { valid: false, reason: "título citado não está no contexto" };
    }
  }

  return { valid: true };
}

export function isCorruptedHistoryMessage(content: string): boolean {
  return !validateOracleResponse(content).valid;
}
