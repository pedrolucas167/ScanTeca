# Jornada — terceira etapa de Leitura

13/10/2026. Branch `feat/reading-journey`, sobre `feat/reading-sessions`.

## Arquitetura

As páginas privada e pública agora usam `getJourney` e `getSharedJourney` do
módulo Leitura. Consultas e cálculos de estatísticas saíram das páginas.
`journey-metrics.ts` contém regras puras; `journey.ts` coordena o acesso a dados.

A API pública `@/modules/reading/client` exporta somente cálculo de metas e seu
schema, sem Prisma ou adaptadores de servidor. GoalCard e configurações usam
esse contrato. O lint reconhece essa entrada pública sem liberar arquivos internos.

## Regras e correções

- Instantes são interpretados em America/Sao_Paulo. Campos Date do PostgreSQL
  já representam uma data de calendário e mantêm sua data UTC, sem conversão
  adicional. Gravação diária, sequência, heatmap e ano usam a mesma política.
- Dias sem páginas, páginas negativas e registros futuros não contam na sequência.
  A sequência pode terminar ontem; duplicatas do mesmo dia são somadas.
- “Páginas na semana” significa últimos sete dias, incluindo hoje.
- O heatmap mantém 15 semanas de domingo a sábado, com datas e títulos estáveis
  independentemente do fuso do servidor.
- Ritmo e duração média usam dias de calendário; intervalos inválidos são
  descartados. Progresso é limitado a 100%, e previsão não produz dias negativos.
- A primeira criação das configurações agora persiste `yearlyGoal`. Antes, só
  atualizações de configurações existentes gravavam a meta. O rate limit do
  endpoint também usa sua própria configuração.
- Jornada pública seleciona somente campos necessários e não retorna notas
  privadas. Compartilhamento desligado retorna ausência de resultado.
- Push de meta usa a mesma contagem anual da Jornada.

## Validação

- 143 testes unitários passaram em 19 arquivos.
- 11 testes com PostgreSQL 16 e pgvector passaram, incluindo concordância de
  Jornada privada/pública/meta na virada de ano e revogação de compartilhamento.
- Build e TypeScript passaram. Lint: zero erros, 21 avisos legados.
- Cenários de calendário incluem ano bissexto, virada de ano, janela semanal,
  dias vazios/futuros e execução sob três fusos diferentes do servidor.
- Banco de testes criado sem volume persistente; nenhuma alteração de schema
  ou dados foi feita na base configurada da aplicação.
- Smoke HTTP do build apontando para o banco descartável: Jornada pública
  retornou 200, exibiu o nome da biblioteca fictícia e não incluiu notas privadas.

Para reproduzir a integração, seguir [READING-VALIDATION.md](./READING-VALIDATION.md).

## Limites mantidos

“Páginas lidas” continua sendo uma fotografia do catálogo (páginas dos livros
READ + progresso dos READING), não um histórico cumulativo de releituras.
A meta anual conta livros atualmente READ, usando `finishedAt` e, quando ausente,
`createdAt` como compatibilidade com dados antigos. Datas futuras são excluídas.
Um histórico preciso de conclusões/releituras exige um modelo de eventos próprio;
esta etapa não introduziu essa mudança de produto ou schema.

Não foi realizada revisão visual autenticada. A interface privada depende de
sessão do Clerk; IA, push real e demais provedores externos não fazem parte da
integração isolada. O CI remoto só executará após publicação das branches.
