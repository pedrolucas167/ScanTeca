import type { OracleMode } from "@/lib/constants/oracle";

const personalReference = /\b(?:meus?|minhas?|nossos?|nossas?)\s+(?:acervo|biblioteca|estante|livros?|exemplares?|di[aá]rio|anota[cç][õo]es|notas|leituras?|hist[oó]rico|progresso|registros?)\b/iu;
const personalQuestion = /\b(?:eu\s+(?:tenho|possuo|li|anotei|registrei|terminei|comecei)|(?:o que|quais livros|qual livro|quantos livros)\s+(?:eu\s+)?(?:li|tenho|possuo|anotei|registrei|terminei|estou lendo)|(?:tenho|possuo)\s+(?:um exemplar|algum livro|esse livro|essa obra)|onde\s+(?:guardei|coloquei|est[aá]\s+(?:meu|minha))|(?:consta|est[aá]|tem|h[aá])\s+(?:n[oa]|em)\s+(?:acervo|estante|di[aá]rio)|(?:estou|ando)\s+lendo|(?:parei|anotei)\s+(?:de ler|na p[aá]gina))\b/iu;
const dependentFollowUp = /^(?:(?:sim|n[aã]o|certo)[,.]?\s+)?(?:e\s|tamb[eé]m\b|quais\??$|(?:desse|dessa|dele|dela)\b|(?:pode\s+)?(?:detalhe|detalhar|continue|continuar|d[eê] exemplos|dar exemplos)\b)/iu;
const inventoryQuestion = /^(?:(?:eu\s+)?(?:tenho|possuo)|(?:quais|que|quantos)\s+(?:livros|obras|exemplares).{0,80}\b(?:tenho|possuo|li|j[aá]\s+terminei)|onde\s+(?:encontro|fica|est[aá])\s+(?:o|a)\s+(?:livro|exemplar|volume))\b/iu;
const literaryAspect = /\b(?:estilo|narrador|linguagem|temas?|personagens?|enredo|contexto hist[oó]rico|quem escreveu|publica[cç][aã]o)\b/iu;

function refersToLibrary(question: string) {
  return personalReference.test(question) || personalQuestion.test(question) || inventoryQuestion.test(question);
}

export function needsLibraryEvidence(question: string, mode: OracleMode, priorQuestions: string[] = []) {
  if (refersToLibrary(question)) return true;
  if (literaryAspect.test(question)) return false;
  if (dependentFollowUp.test(question)) {
    for (const prior of priorQuestions) {
      if (refersToLibrary(prior)) return true;
      if (literaryAspect.test(prior) || !dependentFollowUp.test(prior)) break;
    }
  }
  if (mode === "LOCATE" || mode === "JOURNEY") return true;
  return (mode === "RECOMMEND" || mode === "CURATE") &&
    /\b(?:recomend\p{L}*|indiqu\p{L}*|sugir\p{L}*|lista|sequ[eê]ncia|o que (?:posso|devo) ler)\b/iu.test(question);
}
