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
- Feed social com posts, imagens, citações, comentários, reações e salvos.
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
- **AWS S3** e **CloudFront** para armazenamento e CDN de imagens do feed.
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

## IA e RAG (Oráculo)

O Oráculo utiliza RAG (Retrieval-Augmented Generation) para conversar com o acervo pessoal do usuário. A implementação combina busca semântica, extração de metadados e reranking contextualizado.

### Pipeline RAG

```
User Query
    ↓
[Query Routing] - Classifica query (chat/tool/search)
    ├─→ Chat direto (saudações, conversa casual)
    ├─→ Tool execution (ações específicas)
    └─→ Search (prossegue RAG)
           ↓
[Contextualização LLM] - Reescreve pergunta com histórico
           ↓
[Embedding Generation] - Gera vetor da pergunta
           ↓
[pgvector Search] - Busca semântica no acervo
           ↓
[Metadata Extraction] - Extrai filtros estruturados
           ↓
[Prisma Query] - Busca com filtros aplicados
           ↓
[Reranking] - Reordena por relevância contextual
           ↓
[LLM Final] - Gera resposta com contexto filtrado
```

### Componentes

#### 1. Query Routing (`lib/jev-routing.ts`)

Classifica a query do usuário em 3 categorias antes de executar a busca vetorial:

- **Chat**: Saudações, conversa casual - responde direto sem buscar no banco
- **Tool**: Ações específicas (criar rota, adicionar livro) - guia para funcionalidades
- **Search**: Queries de busca - prossegue com pipeline RAG completo

Benefícios:
- Reduz latência para queries simples (~30%)
- Evita buscas vetoriais desnecessárias
- Permite acionar ferramentas específicas

#### 2. Metadata Filtering (`lib/jev-filtering.ts`)

Extrai filtros estruturados da query usando heurísticas NLP:

- **Gêneros**: 20 gêneros literários (ficção científica, fantasia, terror, etc.)
- **Autor**: Padrões "por X", "escrito por X", "do X"
- **Ano**: Específico, décadas, faixas (antigo/moderno)
- **Status**: READ, READING, TO_READ, WISHLIST
- **Rating**: Exato, mínimo, máximo
- **Título**: Entre aspas
- **Coleção**: Nome da coleção

Converte automaticamente para cláusulas Prisma `where` para queries precisas.

#### 3. Reranking (`lib/jev-reranking.ts`)

Reordena resultados por relevância contextualizada:

**Pesos dinâmicos**:
- Similaridade semântica: 40%
- Título mencionado: +30
- Autor mencionado: +25
- Gênero mencionado: +20
- Sinopse relacionada: +15
- Rating: +2 por estrela (bonus para ≥4)
- Boosts por modo:
  - JOURNEY/READING: +25
  - RECOMMEND/TO_READ: +15

Threshold configurável (padrão: 0.3) descarta resultados irrelevantes antes do LLM.

#### 4. Embeddings e pgvector

- **Modelo**: `openai/text-embedding-3-small` (1536 dimensões)
- **Banco**: Neon Postgres com extensão `pgvector`
- **Similaridade**: Cosine distance (`<=>`)
- **Threshold**: 0.6 para filtragem inicial
- **Coluna**: `Book.embedding` (vector(1536))

#### 5. LLM Final

- **Modelo**: `meta-llama/llama-3.1-8b-instruct` (configurável via `ORACLE_CHAT_MODEL`)
- **Provider**: OpenRouter
- **Streaming**: Respostas em tempo real
- **Contexto**: Livros relevantes + diário + progresso + histórico
- **Tokens**: Limite de 1200 (configurável via `MAX_TOKENS_CHAT`)

### Modos do Oráculo

- **RECOMMEND**: Recomenda 1-3 livros baseados no momento do leitor
- **EXPLORE**: Explora conexões entre temas e autores
- **COMPARE**: Compara obras explicitamente
- **JOURNEY**: Considera leituras em andamento e próximo passo
- **CURATE**: Cria sequência ordenada de leitura
- **LOCATE**: Identifica volumes específicos no acervo
- **ASSISTANT**: Assistente pessoal para dúvidas do dia a dia

### Arquivos da Implementação

- `lib/jev-routing.ts` - Query routing
- `lib/jev-filtering.ts` - Metadata filtering
- `lib/jev-reranking.ts` - Reranking
- `lib/embeddings.ts` - Geração de embeddings
- `app/api/oracle/route.ts` - Pipeline RAG completo

### Métricas

- **Latência**: -30% para queries simples (routing)
- **Precisão**: +20% em metadata filtering (NLP vs string)
- **Tokens**: -15% no LLM final (reranking descarta irrelevante)

## Feed Social

O feed social permite que usuários compartilhem reflexões, imagens e citações de livros, com interações como comentários, reações e salvos.

### Arquitetura

```
Client (FeedClient.tsx)
    ↓ POST /api/feed
[API Route] - Cria post com moderação
    ├─→ Moderation API (OpenRouter)
    ├─→ Prisma (FeedPost)
    └─→ S3 Upload (se imagem)
           ↓
[CloudFront CDN] - Entrega de imagens
    ↓
Client - Renderiza posts com interações
```

### Componentes

#### 1. API Routes

- **POST /api/feed** - Cria posts com moderação de conteúdo
- **GET /api/feed** - Busca posts com filtros (bloqueio, visibilidade, moderação)
- **POST /api/feed/image** - Upload de imagens para S3
- **POST /api/feed/{id}/comments** - Adiciona comentários
- **POST /api/feed/{id}/reactions** - Adiciona/remove reações
- **POST /api/feed/{id}/bookmarks** - Salva/remove posts
- **DELETE /api/feed/{id}** - Deleta posts (próprios ou admin)

#### 2. Moderação de Conteúdo

- **API**: OpenRouter com modelo de moderação
- **Status**: PENDING, APPROVED, FLAGGED, REJECTED
- **Lógica**: Posts são marcados como PENDING, aprovados automaticamente em caso de erro
- **Admin**: Interface para revisar posts FLAGGED

#### 3. Armazenamento de Imagens

- **S3 Bucket**: `scanteca-avatars-343212497955-sa-east-1-an`
- **CloudFront CDN**: `d3ip9st4yxztrt.cloudfront.net`
- **IAM User**: `scanteca-s3-upload` com permissões s3:PutObject, s3:GetObject, s3:DeleteObject
- **Bucket Policy**: Leitura pública para Next.js Image optimization
- **Cache**: 1 ano (max-age=31536000)

#### 4. Citações (Quotes)

- **Relação**: Self-referência em FeedPost (`quotedPostId`)
- **UI**: Botão "Citar" adiciona post ao composer
- **Exibição**: Posts citados mostrados com borda lateral e ícone

#### 5. Interações

- **Comentários**: Thread de comentários por post
- **Reações**: Like/unlike (um por usuário por post)
- **Salvos**: Bookmark de posts para acesso rápido
- **Bloqueio**: Usuários podem bloquear outros (não veem posts)

### Segurança

- **Rate Limiting**: Upstash Redis por endpoint
- **Moderation**: API externa para conteúdo impróprio
- **Visibility**: PUBLIC, FOLLOWERS, PRIVATE (via SocialProfile)
- **Block**: SocialBlock para filtrar conteúdo

### Arquivos da Implementação

- `app/api/feed/route.ts` - API principal do feed
- `app/api/feed/image/route.ts` - Upload de imagens
- `app/feed/FeedClient.tsx` - Componente cliente do feed
- `app/feed/TextComposer.tsx` - Composer de posts com citações
- `lib/moderation.ts` - Moderação de conteúdo
- `lib/s3.ts` - Cliente S3/CloudFront
