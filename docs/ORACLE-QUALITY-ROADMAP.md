# Oráculo: roadmap de qualidade

Iniciado em 30/10/2026. A ordem prioriza qualidade percebida e evidências antes
de ampliar personalização e operação. Implementação local não confirma deploy.

Entrega integrada na `main` em **31/10/2026** pelo
[PR de recuperação fundamentada e memória controlável](https://github.com/pedrolucas167/ScanTeca/pull/178).
O deployment de produção do merge foi confirmado na Vercel; CI da principal e
smoke das quatro rotas públicas passaram. Esse aceite público não substitui os
cenários autenticados e a avaliação representativa definidos abaixo.

| Etapa | Entrega e aceite | Estado |
| --- | --- | --- |
| 1. Busca híbrida | Combinar candidatos semânticos, título/autor e filtros; aceitar livros sem embedding; manter isolamento de conta | Implementada, testada e publicada em 31/10/2026; relevância em acervo representativo ainda em avaliação |
| 2. Evidências | Uma numeração compartilhada entre contexto e fontes; rejeitar referências inexistentes; distinguir inferências no prompt | Implementadas, testadas e publicadas em 31/10/2026; checagens heurísticas não demonstram apoio semântico de toda afirmação |
| 3. Avaliação | Perguntas de referência para busca e citações; depois avaliar relevância e fidelidade com acervo representativo e modelo real | Última rodada sintética real: 10/10; caso externo repetido mais três vezes com o mesmo prompt: 3/3; falhas anteriores preservadas no histórico; acervo representativo e revisão humana independente pendentes |
| 4. Personalização | Leitor consulta, corrige e apaga o perfil; recomendações explicam relação com preferências | Migração aplicada em produção em 30/10/2026 e aplicação publicada em 31/10/2026; aceite autenticado específico do Oráculo é a próxima etapa |
| 5. Desempenho e experiência | Medir latência e tokens por etapa; mostrar andamento da consulta; avaliar custos com dados reais | Instrumentação opcional e progresso SSE publicados; cenário sintético com streaming e custo real validado; coleta de métricas em produção pendente |
| 6. Modularização | Separar contexto, geração, sessões e artefatos e validar suas falhas | Concluída no fluxo fundamentado e nos recursos de sessões/artefatos: contexto textual, reescrita, geração, orquestração e operações extraídas; 431 testes unitários, 100 de integração e 14 de navegador aprovados; voz segue fora do escopo funcional completo |

## Próxima etapa — aceite autenticado e avaliação representativa

**Prioridade atual:** validar o fluxo completo do Oráculo e a qualidade das
respostas antes de considerar encerrado o roadmap. Esta etapa está planejada;
seus critérios abaixo ainda não estão aprovados.

- [ ] Criar cenários autenticados específicos do Oráculo com conta Clerk de
  desenvolvimento e banco descartável: conversa, histórico, regeneração,
  cancelamento, novas tentativas, memória e artefatos, verificando persistência.
- [ ] Usar uma segunda conta para comprovar isolamento de conversas, memória e
  artefatos, incluindo acesso direto às APIs e permanência dos dados do dono.
- [ ] Ampliar o acervo fictício e as perguntas para cobrir gêneros, extensões,
  títulos acentuados, livros sem embedding, preferências declaradas e catálogo
  externo. Exercitar recuperação e formatação reais, além de contextos fixos.
- [ ] Definir os critérios antes da rodada com modelo real; registrar todas as
  respostas, fontes, falhas, latência e custo, sem selecionar só as favoráveis.
- [ ] Submeter as respostas a revisão humana explícita, separando seu resultado
  do julgamento automático e das checagens numéricas de citações.
- [ ] Registrar o aceite autenticado possível em produção sem inserir dados de
  teste nem alterar registros reais. Cenários de gravação ficam no ambiente
  isolado; qualquer uso de dados reais exige autorização específica.

Conclusão: evidência reproduzível dos cenários autenticados, relatório da rodada
representativa e aceite humano registrados, com falhas e limitações explícitas.
A instrumentação de produção, voz e as demais frentes do projeto continuam como
validações separadas. Marcar esta etapa não inicia os testes nem a marca como feita.

## Primeiro corte

- Busca semântica passa de 5 para 24 candidatos; contexto seleciona até 6 livros.
- `modules/oracle/retrieval.ts` consulta título, autor e gênero e combina os
  candidatos com os filtros existentes. Candidatos semânticos também precisam
  satisfazer os filtros solicitados. Resultados de metadados não dependem de
  similaridade vetorial para entrar no contexto.
- Falha na geração do embedding permite continuar com metadados e busca textual.
  Isso não dispensa o provedor de chat para gerar a resposta.
- Filtros reconhecem limites de páginas e “não lidos”; intervalos de anos exigem
  ambos os limites e aceitam datas cadastradas apenas como ano.
- Comparações com dois títulos entre aspas não restringem a busca ao primeiro.
- `modules/oracle/evidence.ts` mantém os identificadores de livros, diário,
  avaliações e pesquisa externa alinhados ao array enviado e persistido.
- Citações fora do intervalo de fontes produzem uma mensagem de falha de
  confiabilidade e a resposta inválida não é salva.
- Estatísticas incluem disponibilidade do embedding e contagem de candidatos
  textuais e de metadados.

## Limites e próxima validação

A etapa de desempenho e seus limites estão em
[ORACLE-PERFORMANCE.md](./ORACLE-PERFORMANCE.md). Os números de testes abaixo
registram o primeiro corte, não o total atual da branch.

A preparação da conversa e o isolamento das consultas de contexto estão em
[ORACLE-MODULES.md](./ORACLE-MODULES.md), com transações e consultas vetoriais
verificadas em PostgreSQL local descartável.

A revisão técnica posterior está em [ORACLE-REVIEW.md](./ORACLE-REVIEW.md), com
correções de tentativas repetidas e embeddings inválidos, 403 testes unitários,
92 de integração e 14 de navegador aprovados. Essa revisão pelo agente não
substitui aceite com acervo representativo ou revisão humana independente.

A continuação de personalização está em
[ORACLE-PERSONALIZATION.md](./ORACLE-PERSONALIZATION.md). A migração de controles
de memória foi aplicada e verificada em produção; a publicação do código segue
separada pelo fluxo de PR. O cenário novo
de preferências foi avaliado separadamente; os números históricos abaixo e a
avaliação geral de nove cenários não foram substituídos por esse resultado.

Validação local: `npm test -- --maxWorkers=2 --testTimeout=20000` passou com
305 testes em 50 arquivos; `npx tsc --noEmit` e ESLint nos arquivos alterados
também passaram. A execução padrão teve um timeout no teste de cadastro manual;
esse teste passou isolado com limite ampliado e na suíte com menor concorrência.
Não foi executada integração com PostgreSQL real neste corte.

O build de produção passou com `npx next build --webpack` fora do sandbox,
incluindo TypeScript e geração das 51 páginas estáticas. A tentativa padrão
com Turbopack falhou ao iniciar o processo de transformação de CSS; a tentativa
Webpack no sandbox encontrou restrições de Google Fonts e gravação em `.next`.
Nenhuma configuração de compilador foi alterada no projeto.

Os testes determinísticos verificam recuperação e correspondência numérica das
fontes. Não demonstram que uma afirmação é sustentada pelo trecho citado, nem
obrigam todas as afirmações a terem citação. A avaliação com modelo real está em
[ORACLE-EVALUATION.md](./ORACLE-EVALUATION.md), com respostas, julgamento e medidas
de latência e tokens em relatórios locais. Ainda é necessário ampliar para um
acervo representativo e revisar o julgamento automático com leitores reais.

A busca textual usa `contains` sem distinguir maiúsculas de minúsculas; a
normalização de acentos no ranking não torna a consulta ao banco insensível a
acentos. Os limites de candidatos e os filtros heurísticos também precisam ser
avaliados em acervos grandes. Estatísticas e progresso de leitura ainda não
possuem fontes numeradas próprias. Microfone, TTS e navegação autenticada não
estão cobertos por este corte.
