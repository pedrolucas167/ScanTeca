# Arquitetura e Padrões do ScanTeca

Este documento descreve os padrões de arquitetura e convenções utilizados no projeto ScanTeca para garantir consistência e manutenibilidade.

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
- `refactor/*`: Branches de refatoração
- `feature/*`: Branches de novas funcionalidades
- `fix/*`: Branches de correções de bugs

### Commits

Use mensagens de commit descritivas:

```
feat: adicionar nova funcionalidade X
fix: corrigir bug Y
refactor: melhorar organização de código Z
docs: atualizar documentação
```

## Próximos Passos

- [ ] Adicionar testes unitários para componentes críticos
- [ ] Configurar pre-commit hooks com Husky
- [ ] Adicionar Storybook para documentação de componentes
- [ ] Implementar CI/CD com testes automatizados
