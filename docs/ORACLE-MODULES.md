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

## Validação e limites

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
A montagem textual do contexto, reescrita da pergunta e orquestração da geração
continuam na rota. Separá-las e revisar os endpoints de sessões e artefatos
permanece como continuação da modularização.
