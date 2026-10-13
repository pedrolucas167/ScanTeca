# Arquitetura e Padrões do ScanTeca

Este documento descreve os padrões de arquitetura e convenções utilizados no projeto ScanTeca para garantir consistência e manutenibilidade.

## Migração incremental para módulos (13/10/2026)

O projeto é um monólito Next.js em migração. O primeiro corte está em
`modules/library` (operações de livros) e `modules/reading` (transições e registro
de progresso). Os consumidores importam somente `@/modules/library` ou
`@/modules/reading`; cada `index.ts` define sua API pública. O ESLint restringe
imports internos e dependências diretas dos módulos em HTTP/UI/Clerk.

`app/api/books/route.ts` autentica, limita requisições, valida entradas e traduz
resultados/erros para HTTP. Biblioteca coordena persistência e chama Leitura
pela API pública. A atualização de livro e diário usa uma transação serializável;
chamadas externas ficam fora dela. Adaptadores existentes em `lib/` continuam
sendo reutilizados durante a migração. As outras páginas e APIs ainda seguem
a organização anterior; esta mudança não torna o projeto inteiro modular.

Escopo, critérios de conclusão, estimativas e limites de validação estão em
[DEVELOPMENT-ROADMAP.md](./DEVELOPMENT-ROADMAP.md).

Na segunda etapa, sessões, diário e marginalia foram migrados para Leitura.
As páginas de diário/leitura consultam sua API pública. Pausas são idempotentes
e conciliam páginas já registradas pelo catálogo; autorização exige propriedade
do livro e correspondência da sessão/trecho. Dez testes com PostgreSQL isolado
validaram concorrência, rollback e autorização. Jornada ainda usa consultas e
cálculos legados. Consulte [READING-VALIDATION.md](./READING-VALIDATION.md).

## Estrutura de Diretórios

```
scanteca/
├── app/                    # Páginas e rotas do Next.js (App Router)
│   ├── admin/             # Rotas administrativas
│   ├── api/               # API Routes
│   ├── books/             # Páginas relacionadas a livros
│   ├── oracle/            # Página do Oráculo AI
│   ├── layout.tsx         # Layout raiz da aplicação
│   └── page.tsx           # Página inicial
├── components/            # Componentes React reutilizáveis
│   └── ui/               # Componentes de UI genéricos (botões, inputs, etc.)
├── lib/                   # Utilitários e lógica compartilhada
│   ├── constants/        # Constantes globais (status, modos, etc.)
│   ├── types/            # Definições de tipos TypeScript
│   ├── *.ts              # Funções utilitárias (validação, fetch, etc.)
├── prisma/               # Schema e migrations do Prisma
└── public/               # Arquivos estáticos
```

## Convenções

### Componentes React

- **Localização**: Componentes reutilizáveis devem ficar em `components/ui/`
- **Nomenclatura**: Use PascalCase para nomes de componentes
- **Imports**: Use alias `@/` para imports absolutos
- **Tipagem**: Sempre use TypeScript com interfaces ou types explícitos

```tsx
// ✅ Bom
import { Button } from "@/components/ui/Button";
import type { Book } from "@/lib/types/book";

// ❌ Ruim
import { Button } from "../../../components/ui/Button";
```

### Tipos e Interfaces

- **Localização**: Definições de tipos devem ficar em `lib/types/`
- **Organização**: Separe tipos por domínio (book.ts, oracle.ts, etc.)
- **Exports**: Use `export interface` ou `export type` para reutilização

```typescript
// lib/types/book.ts
export type BookStatus = "READ" | "READING" | "TO_READ" | "WISHLIST";

export interface Book {
  id: string;
  title: string;
  status: BookStatus;
  // ...
}
```

### Constantes

- **Localização**: Constantes globais devem ficar em `lib/constants/`
- **Organização**: Separe por domínio (book-status.ts, oracle.ts, etc.)
- **Nomenclatura**: Use UPPER_SNAKE_CASE para constantes exportadas

```typescript
// lib/constants/book-status.ts
export const BOOK_STATUS_LABELS = {
  READ: "Lido",
  READING: "Lendo",
  // ...
} as const;
```

### Hooks Customizados

- **Localização**: Hooks customizados devem ficar em `hooks/`
- **Nomenclatura**: Prefixe com `use` (ex: `useOracleScroll`)
- **Responsabilidades**: Cada hook deve ter uma responsabilidade única

```typescript
// hooks/useOracleScroll.ts
export function useOracleScroll(loading: boolean, messages: Message[]) {
  // Lógica de scroll
}
```

## Configurações de Lint e TypeScript

### ESLint

O projeto usa ESLint com regras estritas para garantir qualidade do código:

- `@typescript-eslint/no-unused-vars`: Erro em variáveis não utilizadas
- `@typescript-eslint/no-explicit-any`: Aviso sobre uso de `any`
- `react-hooks/rules-of-hooks`: Erro em violação de regras de hooks
- `react-hooks/exhaustive-deps`: Aviso sobre dependências faltantes

### TypeScript

Configurações adicionais para maior segurança de tipos:

- `noUnusedLocals`: Erro em variáveis locais não utilizadas
- `noUnusedParameters`: Erro em parâmetros não utilizados
- `noFallthroughCasesInSwitch`: Erro em fallthrough de switch
- `noImplicitReturns`: Erro em funções sem return explícito
- `noUncheckedIndexedAccess`: Erro em acesso a array sem checagem

## Boas Práticas

### 1. Evitar Duplicação

- Extraia componentes reutilizáveis para `components/ui/`
- Centralize constantes em `lib/constants/`
- Compartilhe tipos através de `lib/types/`

### 2. Separação de Responsabilidades

- Componentes devem focar em UI
- Lógica de negócio deve ficar em `lib/` ou hooks customizados
- API routes devem lidar apenas com requisições HTTP

### 3. Tipagem Forte

- Evite `any` sempre que possível
- Use `unknown` quando o tipo não é conhecido
- Prefira interfaces para objetos, types para unions/primitivos

### 4. Performance

- Use `useMemo` para cálculos pesados
- Use `useCallback` para funções passadas como props
- Prefira componentes server-side quando possível

## Git Workflow

### Branches

- `main`: Branch de produção
- `develop`: Branch de integração
- `feat/<modulo>`: Desenvolvimento de cada módulo
- `fix/<escopo>`: Correções isoladas
- `refactor/<escopo>`: Refatorações sem mudança funcional

Usar uma branch por módulo. Quando houver dependência entre módulos, criar
branches encadeadas e integrar na ordem da dependência. A primeira extração usa
`fix/validation-baseline` → `feat/reading-module` →
`feat/library-module`, preservando a base existente em `fix/build-errors`.
Essa base está à frente de `develop`; sua integração deve ser tratada antes de
abrir uma comparação final contra `develop` para evitar incluir trabalho anterior.

### Commits

Use mensagens de commit descritivas:

```
feat: adicionar nova funcionalidade X
fix: corrigir bug Y
refactor: melhorar organização de código Z
docs: atualizar documentação
```

Separar commits por mudança coerente, usando Conventional Commits (`feat:`,
`fix:`, `refactor:`, `test:`, `docs:`, `chore:`). Não adicionar trailers
`Co-authored-by` ou qualquer atribuição de coautoria aos commits.

## Próximos Passos

- [ ] Adicionar testes unitários para componentes críticos
- [ ] Configurar pre-commit hooks com Husky
- [ ] Adicionar Storybook para documentação de componentes
- [ ] Implementar CI/CD com testes automatizados
