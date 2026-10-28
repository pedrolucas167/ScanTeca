export const ORACLE_ACTIONS = {
  create_route: { href: "/rota", label: "Abrir rotas de leitura", message: "Abra as rotas de leitura para escolher os livros e confirmar sua rota." },
  add_book: { href: "/manual-add", label: "Cadastrar um livro", message: "Abra o cadastro para preencher e confirmar o livro que deseja adicionar." },
  update_status: { href: "/", label: "Abrir meu catálogo", message: "No catálogo, selecione o livro e confirme a alteração do status ou do progresso." },
} as const;

export type OracleAction = keyof typeof ORACLE_ACTIONS;
export function isOracleAction(value: unknown): value is OracleAction {
  return typeof value === "string" && Object.hasOwn(ORACLE_ACTIONS, value);
}
