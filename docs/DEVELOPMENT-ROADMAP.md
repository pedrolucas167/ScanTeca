# Roadmap de modularização — ScanTeca

Atualizado em 13/10/2026. Estratégia: migração incremental no mesmo Next.js,
PostgreSQL e deploy. Estimativas em dias de engenharia focada de uma pessoa,
incluindo revisão e testes; não são prazos de calendário ou compromissos.

## Ordem por criticidade

| Prioridade | Entrega | Esforço restante inicial | Confiança | Critério de aceite |
| --- | --- | --- | --- | --- |
| P0 | Base de validação e primeiro corte Biblioteca/Leitura | Implementado neste corte; validações registradas abaixo | Alta para o corte local | Build, testes, lint e smoke HTTP verificáveis |
| P0 | Completar consistência e autorização de Leitura | Núcleo de sessões/diário/anotações implementado; 1–3 dias para jornada e revisão autenticada | Média | PostgreSQL isolado validou rollback e concorrência; concluir jornada e smoke autenticado |
| P1 | Completar Biblioteca | 3–5 dias | Média | Enrich, reorder, consultas e coleções usam a API pública; deduplicação concorrente definida; integrações externas têm limites de tempo |
| P1 | Oráculo | 5–8 dias | Média-baixa | Separar retrieval, contexto, geração, streaming e persistência; fixtures de qualidade, cancelamento e falhas; medir latência e tokens |
| P1 | Jobs e notificações | 3–5 dias | Baixa | Worker executável no ambiente de deploy; retirada atômica, retentativas e recuperação; efeitos idempotentes |
| P2 | Comunidade | 4–7 dias | Média-baixa | Política única de visibilidade, bloqueios e autorização usada em feed, perfis, clubes e discussões |
| P2 | Interface e operação | 3–5 dias | Média-baixa | Dividir catálogo e Oráculo por responsabilidade; métricas de produção e fluxos principais exercitados em navegador |

Reestimar cada linha depois de concluir a anterior. O build local demonstra
compatibilidade de compilação; não valida integrações autenticadas em produção.

A segunda etapa de Leitura está registrada em
[READING-VALIDATION.md](./READING-VALIDATION.md): 115 testes unitários e dez testes
de PostgreSQL real passaram. Os limites do primeiro corte descritos abaixo são
históricos; a integração de Leitura já avançou, e o smoke autenticado está pendente.

## Primeiro corte implementado

- `modules/library`: contratos de entrada, erros e operações de criar, atualizar
  e excluir livros. `/api/books` mantém autenticação, rate limiting, parsing e
  tradução de resultados para HTTP.
- `modules/reading`: regras de mudança de status, conclusão, releitura e delta
  de páginas, além da gravação diária dentro da transação do chamador.
- Atualização do livro e registro diário usam transação serializável, releitura
  do estado dentro da transação e até três tentativas em conflitos P2034.
- Repetir READ não aumenta `readCount` nem altera a data de conclusão.
- Reiniciar releitura não registra páginas antigas como leitura nova.
- Atualizar progresso sem informar capa não dispara uma busca externa de capa.
- Falhar a indexação após salvar o livro é registrado sem transformar a gravação
  já confirmada em erro HTTP. Reconstrução ainda depende do backfill existente;
  uma fila durável de indexação permanece no roadmap.
- Dia do registro diário definido em America/Sao_Paulo, independentemente do host.
- ESLint restringe importação de arquivos internos dos módulos e dependências
  diretas dos módulos em HTTP, UI e Clerk. Consumidores usam `@/modules/<nome>`.
- Os três scripts locais Jev foram convertidos em testes Vitest e incluídos no
  versionamento; reviews usam mock de embeddings para evitar chamadas reais.
- Corrigida extração de “pelo menos 4 estrelas”, que antes também impunha máximo 4.

## Limites arquiteturais deste corte

O projeto ainda não é inteiramente modular. Páginas e demais APIs continuam
acessando Prisma e `lib/` diretamente. Os módulos iniciais reutilizam adaptadores
legados de metadados, coleções, cache, embeddings e push; movê-los sem tratar
seus consumidores existentes criaria duas fontes de verdade.

Biblioteca coordena a gravação do livro; Leitura fornece regras e grava o diário
na mesma transação. A direção atual é Biblioteca → Leitura. O módulo Leitura
não importa Biblioteca. Não introduzir dependência inversa; revisar essa fronteira
ao migrar sessões e o endpoint de diário.

## Evidência inicial

- Build anterior às alterações: passou, incluindo TypeScript e geração de rotas.
- Testes anteriores: 40 passaram, 2 falharam e 3 arquivos não tinham suítes.
- Lint anterior: 1 erro e 74 avisos, incluindo os scripts locais Jev.
- CI já existente em `.github/workflows/ci.yml`: lint, testes e build. Não foi
  necessário criar outro pipeline.
- Smoke inicial do build anterior: `/`, `/oracle` e `/manifest.json` retornaram
  200; GET `/api/books` retornou 405, coerente com a ausência de handler GET.

## Validação e próximos gates

Resultado final deste corte:

- `npm run build`: passou, incluindo TypeScript e geração das rotas. Aviso
  preexistente: convenção `middleware` depreciada em favor de `proxy`.
- `npm test`: 104 testes passaram em 14 arquivos; sem chamadas reais a IA.
- `npm run lint`: passou, com zero erros e 21 avisos em arquivos legados.
- Execução com `npm start -- --port 3100`: servidor iniciou; GET `/`, `/oracle`
  e `/manifest.json` retornaram 200. POST/PATCH/DELETE `/api/books` sem sessão
  retornaram 401. Servidor temporário encerrado depois da verificação.
- `git diff --check`: passou.

Os testes deste corte usam mocks do Prisma para verificar decisões, limites da
transação, propagação de falhas e retentativas. Não comprovam rollback real ou
isolamento serializável do PostgreSQL. Antes de concluir Leitura, usar uma base
de testes dedicada e testar solicitações concorrentes contra o banco real.

Não aplicar migrações nem inserir dados de teste na base configurada sem
identificar seu ambiente. Verificar histórico de migrações separadamente antes
de qualquer mudança de schema. Nenhuma alteração de schema é necessária neste corte.

Ainda necessários: smoke autenticado de cadastro/progresso, jornada no navegador,
validação de voz/IA, Redis, S3, push e execução efetiva do worker em produção.
