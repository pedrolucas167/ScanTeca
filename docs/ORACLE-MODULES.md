# Módulos do Oráculo

Continuação da etapa 6 em 30/10/2026, na branch `feat/oracle-quality-roadmap`.
A aplicação ainda depende de publicação via PR, CI e merge. Este corte não exige
migração nem altera o banco de produção.

## Preparação da conversa

`modules/oracle/session.ts` verifica propriedade da conversa e grava a pergunta
em uma transação serializável. Ao criar uma conversa, sua criação e a primeira
pergunta são confirmadas juntas. Uma falha na pergunta desfaz a conversa nova.

O identificador de requisição permanece único por leitor. Repetir uma requisição
não cria outra pergunta nem deixa uma conversa vazia. A regeneração continua sem
gravar novamente a pergunta. O módulo devolve o identificador da sessão e o da
mensagem criada; a rota traduz erros conhecidos para HTTP 404 e 409 antes do SSE.
Erros inesperados continuam seguindo o tratamento geral da rota.

## Contexto e memórias

`modules/oracle/context.ts` reúne as leituras de histórico, preferências,
livros em andamento, atividade recente e diário. Remove do histórico a pergunta
enviada separadamente, respostas corrompidas e a resposta escolhida para
regeneração. A ordem e os limites anteriores são preservados.

O mesmo módulo contém as consultas vetoriais parametrizadas de livros, diário,
avaliações e pesquisas externas. Todas restringem os resultados ao leitor.
Diário e avaliações também exigem que o livro relacionado pertença ao mesmo
leitor; um registro com vínculo inconsistente entre contas é excluído. Entradas
de diário com `ragEnabled=false` ficam fora tanto da consulta recente quanto
da vetorial.

Embedding indisponível evita as consultas vetoriais e mantém o caminho de busca
por metadados. Uma falha de banco é propagada ao pipeline, que encerra a consulta
com erro; ela não é interpretada como ausência de evidências. O cancelamento
é conferido antes e depois das leituras. Consultas Prisma já iniciadas podem
terminar no banco, mas seu resultado não segue para a próxima etapa após o aborto.

## Validação e limites do primeiro corte

Os testes de integração usam exclusivamente PostgreSQL local com pgvector,
na base descartável `scanteca_reading_test`, porta 55439. As fixtures contêm
dois leitores fictícios, fontes vetoriais, diários desabilitados e vínculos
inconsistentes entre registros para verificar o isolamento.

- Preparação de sessão: sete testes de integração, incluindo rollback de uma
  sessão nova após duplicidade, propriedade da conversa e regeneração.
- Coleta de contexto: quatro testes de integração, cobrindo contexto do leitor,
  diário desabilitado e as quatro fontes vetoriais para ambos os leitores.
- Falhas e cancelamento: sete testes unitários do contexto, além das verificações
  HTTP 404 e 409 da rota antes de chamar provedores ou iniciar SSE.
- Suíte unitária completa: 384 testes aprovados em 59 arquivos; os testes da
  rota e do contexto também passaram novamente após os ajustes finais.
- Integração completa dos módulos do Oráculo: 24 testes aprovados em quatro
  arquivos, incluindo histórico e controle de versões da memória.
- ESLint nos módulos do Oráculo e na rota alterada: aprovado sem avisos.
- TypeScript (`npx tsc --noEmit`): aprovado. O build e os testes de navegador
  da etapa anterior não foram repetidos neste corte de módulos do servidor.

Os testes verificam comportamento e isolamento das consultas; não estimam
qualidade semântica, relevância em acervos grandes ou desempenho em produção.
A montagem textual, reescrita, geração e os recursos HTTP ainda estavam na rota
nesse primeiro corte. A extração posterior está registrada a seguir.

## Conclusão da modularização do fluxo fundamentado

A rota principal agora mantém autenticação, validação da requisição, limite de
uso, transcrição de entrada e registro de `after` no escopo HTTP. A preparação
da sessão permanece antes do SSE, preservando os erros HTTP de propriedade e
duplicidade. Os módulos não importam Next ou Clerk.

| Módulo | Responsabilidade |
| --- | --- |
| `session.ts` | Schemas e operações de sessão, preparação transacional, listagem, detalhe, alteração e exclusão por dono |
| `artifacts.ts` | Schema, listagem e gravação de artefatos, conferindo a sessão na mesma transação da inserção |
| `home.ts` | Histórico, sugestões e estatísticas iniciais; limpeza do histórico por leitor |
| `context.ts` | Consultas do contexto e memórias vetoriais por leitor |
| `context-format.ts` | Texto de contexto e numeração compartilhada das fontes, sem mutar as entradas |
| `rewrite.ts` | Reescrita contextual, uso informado e fallback para a pergunta original |
| `query.ts` | Orquestração de recuperação, catálogo externo, montagem de mensagens e início da geração |
| `generation.ts` | Chamada do modelo, conclusão explícita, validação, gravação atômica e aprendizado opcional após a resposta |
| `responses.ts` | Respostas casuais, ações de navegação e fallback sem evidências |
| `config.ts` | Configuração compartilhada de modelo e limites de geração |

Os endpoints de sessões e artefatos delegam as operações a essa API pública.
Um adaptador HTTP separado traduz erros de domínio e sanitiza erros inesperados.
As criações também passaram a respeitar os limites nomeados das próprias rotas,
em vez de consultar uma chave de broadcast inexistente.

Os detalhes de sessão filtram mensagens, artefatos e contagens pelo leitor,
incluindo a defesa contra registros com vínculos inconsistentes entre contas.
Excluir uma conversa apaga suas mensagens e preserva os artefatos, desvinculados,
conforme as relações existentes do banco. Limpar o histórico preserva sessões e
artefatos e não toca nas mensagens de outro leitor.

O registro de `after` continua na rota, com um agendador passado ao pipeline.
A resposta continua retida até conclusão, validação e persistência. Uma falha
na gravação não expõe texto como resposta válida nem agenda aprendizado.
Cancelamento chega ao corpo do provedor. Respostas HTTP rejeitadas de geração
e reescrita têm seus corpos liberados sem imprimir conteúdo no log.

O prompt e os critérios de avaliação não foram alterados nesta extração.
A avaliação sintética real anterior permanece registrada separadamente; não
foi repetida como se validasse acervo representativo ou publicação.

Validação final desta extração:

- 431 testes unitários em 63 arquivos, com cobertura.
- 100 testes de integração em 14 arquivos, com PostgreSQL/pgvector e Redis locais
  exclusivos; 32 desses testes cobrem os módulos do Oráculo.
- 14 testes de navegador do Oráculo, em desktop e celular, com API controlada.
- TypeScript aprovado e lint completo sem erros; 17 avisos preexistentes fora
  dos arquivos deste pacote.
- Política de cobertura aprovada sem reduzir a base; cobertura de linhas nos
  módulos: 86,55%; cobertura global: 37,53%.
- Política de workflows e verificação de segredos aprovadas.
- Build `npx next build --webpack` aprovado, incluindo TypeScript, 51 páginas
  e coleta final de arquivos.

Testes novos cobrem os limites HTTP, falta de autenticação, propriedade forjada,
erros sanitizados, ciclo de vida de recursos, isolamento de registros aninhados,
fontes numeradas entre seções, deduplicação, falha de persistência, cancelamento
do provedor e fallback de reescrita. A cobertura global permanece parcial.

Esse escopo conclui a etapa 6 para o fluxo fundamentado e os recursos de sessões
e artefatos. Microfone, TTS e a rota separada de voz continuam fora da revisão
funcional completa. Acervo representativo, revisão humana independente e aceite
autenticado em produção continuam pendentes; modularização não implica deploy.
