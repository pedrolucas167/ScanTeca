import type { Source } from "@/lib/types/oracle";

/** One registry supplies both prompt numbers and the sources sent to the reader. */
export function createEvidenceRegistry() {
  const sources: Source[] = [];
  return {
    sources,
    add(source: Source, content: string) {
      sources.push(source);
      return `[${sources.length}] ${content}`;
    },
  };
}

export function validateCitations(text: string, sourceCount: number) {
  const citations = [...new Set([...text.matchAll(/\[(\d+)\]/g)].map(match => Number(match[1])))];
  return {
    valid: citations.every(number => Number.isSafeInteger(number) && number >= 1 && number <= sourceCount),
    citations: citations.sort((a, b) => a - b),
  };
}
