# Scanteca

Biblioteca pessoal para catalogar livros por ISBN, acompanhar a jornada de leitura e conversar com o acervo por meio do Oráculo.

O projeto é uma **PWA** em português do Brasil. O manifesto define instalação em modo standalone, orientação vertical e as categorias `books`, `utilities` e `lifestyle`.

## Funcionalidades

- Catálogo pessoal com coleções, status de leitura, notas, avaliações e progresso.
- Scanner de código de barras ISBN e cadastro manual.
- Busca e enriquecimento de metadados, capas e sinopses.
- Jornada de leitura, diário, sessões e rota de leitura.
- Recomendações e feedback de livros.
- Oráculo com chat, sessões, artefatos, voz, TTS e memória do acervo.
- Compartilhamento público da biblioteca e avaliações.
- Notificações Web Push, lembretes de leitura e broadcasts administrativos.
- Tema claro/escuro, temas de destaque e instalação como aplicativo.

## Tecnologias

### Aplicação

- **Next.js 16** com App Router e Route Handlers.
- **React 19** e **TypeScript**.
- **Tailwind CSS 4** via `@tailwindcss/postcss`.
- **Lucide React** e **Material Symbols** para ícones.
- **next/font** com Geist, EB Garamond, Playfair Display e Inter.

### Dados e autenticação

- **Neon Postgres** como banco de dados.
- **pgvector** para embeddings e busca semântica.
- **Prisma 6** como ORM e gerenciador de migrações.
- **Clerk** para autenticação, sessões e controle de acesso administrativo.
- **Upstash Redis** para rate limiting e cache compartilhado.

### Integrações

- **ZXing** e **jsQR** para leitura de códigos de barras.
- **Google Books**, **Open Library** e **Wikimedia/Wikipedia** para metadados, capas e sinopses.
- **OpenRouter** para o Oráculo, embeddings e síntese de voz.
- **Web Push** com chaves VAPID para notificações no navegador.
- **Vercel Cron** para lembretes diários de leitura.

### Qualidade e desenvolvimento

- **Vitest** para testes automatizados.
- **ESLint** com a configuração do Next.js.
- **tsx** para executar o seed do Prisma.

## Requisitos

- Node.js 20 ou superior.
- Uma instância PostgreSQL compatível com `pgvector` (o projeto usa Neon).
- Uma aplicação configurada no Clerk.
- Chaves das integrações desejadas, conforme `.env.example`.

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha as variáveis necessárias.

3. Gere o cliente Prisma e aplique o schema:

   ```bash
   npx prisma generate
   npm run db:push
   ```

   Para um ambiente com migrações versionadas, use:

   ```bash
   npm run db:deploy
   ```

4. Inicie o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

Abra [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o cliente Prisma e cria o build de produção |
| `npm start` | Inicia o build de produção |
| `npm run lint` | Executa o ESLint |
| `npm test` | Executa os testes com Vitest |
| `npm run db:migrate` | Cria e aplica uma migração em desenvolvimento |
| `npm run db:deploy` | Aplica migrações existentes |
| `npm run db:push` | Sincroniza o schema com o banco |
| `npm run db:seed` | Popula dados de desenvolvimento |

## Variáveis de ambiente

As variáveis estão documentadas em `.env.example`. As principais são:

- `DATABASE_URL` e `DATABASE_URL_UNPOOLED` para o Neon/Prisma.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY` para o Clerk.
- `OPENROUTER_API_KEY` para o Oráculo, embeddings e voz.
- `GOOGLE_BOOKS_API_KEY` para ampliar as buscas de livros.
- Chaves VAPID para Web Push.
- `CRON_SECRET` para proteger o cron de lembretes.
- Variáveis do Upstash Redis para rate limiting e cache distribuído.

## Estrutura principal

- `app/`: páginas, componentes e APIs do Next.js.
- `lib/`: regras de negócio, integrações externas, cache, rate limiting e utilitários.
- `prisma/`: schema, migrações e seed do banco.
- `public/`: manifesto, service worker e assets da PWA.
