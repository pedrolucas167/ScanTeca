# Roadmap de modularização — ScanTeca

Registro histórico iniciado em 13/10/2026. Estratégia: migração incremental no mesmo Next.js,
PostgreSQL e deploy. Estimativas em dias de engenharia focada de uma pessoa,
incluindo revisão e testes; não são prazos de calendário ou compromissos.

## Estado atual — 28/10/2026

As linhas abaixo registram o contexto histórico em que foram estimadas. Biblioteca,
Prisma e base de testes já avançaram desde então. A auditoria de segurança atual
está em [SECURITY-AUDIT-BASELINE.md](./SECURITY-AUDIT-BASELINE.md); a medição de
cobertura está em [TEST-COVERAGE.md](./TEST-COVERAGE.md); o status dos pacotes
aprovados está em [IMPROVEMENTS-ROADMAP.md](./IMPROVEMENTS-ROADMAP.md).

O pacote E2E de Biblioteca, Leitura e privacidade foi integrado. Cadastro manual,
progresso persistido e isolamento entre contas passaram nos três cenários
autenticados; o workflow da principal também passou com build de produção e
13 cenários de navegador.

O pacote do Oráculo também foi integrado. Cancelamento chega às chamadas de chat,
transcrição e perfil; streams sem marcador completo viram falha e não salvam
resposta parcial. Ações reconhecidas apontam para caminhos fixos e deixam a
confirmação de gravação ao usuário. Build, integração, cobertura, segredos e
smoke de produção passaram. O deploy da principal foi confirmado.

Jobs e notificações, Comunidade e métricas de produção continuam frentes futuras;
este documento não os marca como concluídos.

## Ordem por criticidade

| Prioridade | Entrega | Esforço restante inicial | Confiança | Critério de aceite |
| --- | --- | --- | --- | --- |
| P0 | Base de validação e primeiro corte Biblioteca/Leitura | Implementado neste corte; validações registradas abaixo | Alta para o corte local | Build, testes, lint e smoke HTTP verificáveis |
| P0 | Completar consistência e autorização de Leitura | Migração técnica de sessões/diário/anotações/Jornada concluída; revisão autenticada pendente | Alta nos cenários testados; média na interface | PostgreSQL validou rollback, concorrência, privacidade e estatísticas; concluir revisão autenticada |
| P1 | Completar Biblioteca | Fluxos principais implementados; revisão autenticada e providers reais pendentes | Alta nos cenários testados | Scanner/enrich/reorder/consultas/coleções usam módulo; concorrência passou em PostgreSQL; timeouts por chamada definidos |
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

A terceira etapa migrou Jornada privada/pública, calendário e metas:
[JOURNEY-VALIDATION.md](./JOURNEY-VALIDATION.md). Resultado: 143 testes unitários e
11 de PostgreSQL passando, com build e TypeScript validados. A próxima frente
arquitetural é completar Biblioteca; revisão visual autenticada permanece um gate.

A continuação de Biblioteca está em [LIBRARY-VALIDATION.md](./LIBRARY-VALIDATION.md):
154 testes unitários e 23 de PostgreSQL passaram, com cadastro concorrente,
scanner, enriquecimento, coleções e catálogo compartilhado cobertos. A próxima
frente arquitetural passa a ser Oráculo; revisão autenticada e operação dos
providers continuam gates próprios, sem pressupor validação de produção.

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
