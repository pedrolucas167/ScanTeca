export const ORACLE_DEFAULT_SUGGESTIONS = [
  "O que ler num fim de semana chuvoso?",
  "Livros sobre viagens no tempo",
  "Volume mais antigo do acervo?",
  "+500 páginas não lidas",
];

export const ORACLE_MODES = [
  { id: "RECOMMEND", label: "Recomendar", icon: "recommend" },
  { id: "EXPLORE", label: "Explorar", icon: "travel_explore" },
  { id: "COMPARE", label: "Comparar", icon: "compare_arrows" },
  { id: "JOURNEY", label: "Jornada", icon: "hiking" },
  { id: "CURATE", label: "Curadoria", icon: "collections_bookmark" },
  { id: "LOCATE", label: "Localizar", icon: "route" },
  { id: "ASSISTANT", label: "Assistente", icon: "support_agent" },
] as const;

export type OracleMode = (typeof ORACLE_MODES)[number]["id"];
