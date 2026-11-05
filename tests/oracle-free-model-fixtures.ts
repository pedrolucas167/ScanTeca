// Fictional corpus only. Criteria are versioned before any live model call.
export const freeModelCorpus = [
  { title: "Memórias da Praça Azul", author: "Lia Monte", genre: "Contos", pages: 96, status: "TO_READ" as const, synopsis: "Contos curtos sobre memória coletiva e transformações de uma praça urbana." },
  { title: "O Farol de Vidro", author: "Caio Vale", genre: "Ficção científica", pages: 210, status: "READ" as const, synopsis: "Uma comunidade numa estação orbital negocia o uso de água e energia." },
  { title: "Cartas do Mangue", author: "Iara Costa", genre: "Poesia", pages: 72, status: "READING" as const, synopsis: "Poemas em forma de cartas sobre manguezais, cuidado e mudanças ambientais." },
  { title: "Atlas dos Silêncios", author: "Rui Prado", genre: "Ensaios", pages: 350, status: "TO_READ" as const, synopsis: "Ensaios sobre paisagens sonoras e silêncio nas grandes cidades." },
  { title: "Caderno das Marés", author: "Bia Leste", genre: "Contos", pages: 140, status: "READ" as const, synopsis: "Narrativas de pescadores sobre trabalho e transformações de uma vila costeira." },
  { title: "Jardins de Órbita", author: "Nina Sul", genre: "Ficção científica", pages: 480, status: "TO_READ" as const, synopsis: "Botânicos cultivam plantas para alimentar uma cidade espacial." },
];
export const freeModelCases = [
  { id: "accented-title-no-embedding", question: 'Qual o tema de "Memórias da Praça Azul"?', mode: "EXPLORE" as const, scope: "library" as const,
    expectedTitles: ["Memórias da Praça Azul"], expectedTerms: ["memória", "praça"], profile: null },
  { id: "comparison", question: 'Compare "O Farol de Vidro" e "Cartas do Mangue" usando as sinopses.', mode: "COMPARE" as const, scope: "library" as const,
    expectedTitles: ["O Farol de Vidro", "Cartas do Mangue"], expectedTerms: ["água", "mangue"], profile: null },
  { id: "explicit-preference", question: "Recomende contos com menos de 120 páginas para ler agora.", mode: "RECOMMEND" as const, scope: "library" as const,
    expectedTitles: ["Memórias da Praça Azul"], expectedTerms: ["curt"], profile: "Prefiro contos curtos sobre memória e espaços urbanos." },
  { id: "external-catalog", question: "Indique um livro sobre vulcões, considerando também o catálogo externo.", mode: "CURATE" as const, scope: "all" as const,
    expectedTitles: ["Caderno de Lava"], expectedTerms: ["vulc"], profile: null },
];
export const freeModelExternal = { title: "Caderno de Lava", author: "Eva Pedra", genre: "Divulgação científica", description: "Introdução aos vulcões, ao magma e à formação de ilhas vulcânicas." };
export const freeModelCriteria = {
  version: 3, optionalReasoning: "disabled for catalog-verified optional-reasoning candidates",
  repetitions: 2, maxCompletionMs: 15000, timeoutMs: 30000, maxTokens: 800,
  requireExpectedSources: true, requireCitationsForExpectedTitles: true,
  rejectForeignSources: true, rejectUnsupportedInventoryClaims: true,
  humanSemanticReview: "pending", longTermAvailability: "not established by this short benchmark",
};
