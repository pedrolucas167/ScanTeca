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

/** Retrieved sources are partial; a category cannot be declared absent from the whole library. */
export function validateInventoryClaims(text: string) {
  const claims = text.split(/(?<=[.!?])\s+|\n+/u).filter(sentence => {
    const normalized = sentence.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[*_]/g, "");
    if (/nao (?:posso|podemos|e possivel) afirmar|nao sei se/.test(normalized)) return false;
    const scoped = /\b(?:no|na|neste|nesta|nesse|nessa) (?:contexto|selecao|amostra)\b|fontes? (?:recuperad|consultad|disponive)|livros? (?:recuperad|listad|apresentad)/.test(normalized);
    if (scoped) return false;
    const inventory = /(?:seu|sua|nosso|nossa|o|a) (?:acervo|biblioteca|estante)\b/.test(normalized);
    const absence = inventory &&
      /nao (?:ha|tem|temos|existe[m]?|consta[m]?|contem|possui|possuimos|possuo) (?:(?:um|uma|nenhum|nenhuma|outros?|outras?) )?(?:livros?|obras?|titulos?|exemplares?)\b/.test(normalized);
    const nominalAbsence = /ausencia de (?:livros?|obras?|titulos?|exemplares?)\b[^.!?]*\b(?:no|na|do|da) (?:acervo|biblioteca|estante)\b/.test(normalized);
    const exhaustive = /(?:o|a) unic[oa] (?:livro|obra|titulo|exemplar)\b[^.!?]*(?:que consta\b|(?:n[ao]|em|d[ao]) (?:seu|sua|nosso|nossa) (?:acervo|biblioteca|estante))/.test(normalized);
    return absence || nominalAbsence || exhaustive;
  });
  return { valid: claims.length === 0, claims };
}
