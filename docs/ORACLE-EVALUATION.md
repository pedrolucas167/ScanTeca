# Avaliação de respostas do Oráculo

## Executar

`npm run eval:oracle` prepara e salva os dez cenários sem consultar o provedor.
Nenhum caso é marcado como aprovado no modo offline.

`npm run eval:oracle -- --live` usa `OPENROUTER_API_KEY` e `ORACLE_CHAT_MODEL`
do ambiente ou `.env`, com até 20 chamadas: uma geração e uma avaliação por caso.
As chamadas usam somente dados fictícios versionados em
`tests/oracle-evaluation-fixtures.ts`, sem ler livros, perfis ou anotações reais.
O script não grava no banco de dados.

Para avaliar apenas a personalização com preferências fictícias:
`npm run eval:oracle -- --live --case profile-preferences`. Essa execução faz
duas chamadas. O resultado direcionado está em
[ORACLE-PERSONALIZATION.md](./ORACLE-PERSONALIZATION.md); ele não substitui a
avaliação geral registrada abaixo.

O prompt de geração é compartilhado com a rota da aplicação. A avaliação usa
contextos fixos e não verifica recuperação no PostgreSQL, roteamento, histórico,
autenticação ou o streaming HTTP da aplicação. O cenário sem evidências avalia o prompt; a aplicação
normalmente desvia esse caso para uma resposta local antes de chamar o modelo.

O avaliador usa `ORACLE_EVAL_JUDGE_MODEL` ou, se ausente, o mesmo modelo de geração.
Verifica relevância, fidelidade e apoio das citações. Validações determinísticas
também verificam referências inexistentes, referências exigidas e menções
esperadas. Um resultado favorável do avaliador nunca sobrepõe uma falha numérica.
Também rejeita padrões genéricos de ausência de livros no acervo inteiro,
compartilhando a checagem usada pela API antes da persistência. A checagem é
heurística e não detecta todas as paráfrases possíveis; não é prova semântica.
Julgamento ausente, JSON inválido, timeout ou resposta truncada contam como erro.
As execuções reais retornam código 1 se houver falha ou erro.

## Relatórios e limites

Use `--stream` para gerar pelo parser de streaming compartilhado com a aplicação:
`npm run eval:oracle -- --live --stream --case profile-preferences`.
O julgamento continua sem streaming. Relatórios na versão 3 registram essa opção
e `firstDeltaMs`, quando há texto do provedor. Essa medida não é o tempo até a
exibição da resposta validada na interface. A execução direcionada e seus custos
estão em [ORACLE-PERFORMANCE.md](./ORACLE-PERFORMANCE.md).

Os arquivos JSON ficam em `reports/oracle-evaluation-<data>.json`, ignorados pelo
Git. Contêm as perguntas, fontes fictícias, respostas, julgamento, hash do prompt,
latência de cada chamada e uso/custo informado pelo provedor. Desde a versão 2,
incluem hashes das fixtures e do prompt do avaliador para identificar alterações
de critérios. `missingUsage` e
`missingCost` indicam valores ausentes; totais são somas dos valores disponíveis.
Geração usa temperatura 0,3 e avaliação usa 0. O limite de tokens usa
`ORACLE_MAX_TOKENS` (padrão 800), limitado ao intervalo 200–1600 por chamada.
Não há retentativas automáticas nem seleção da melhor resposta.

Um avaliador automático, especialmente quando usa o mesmo modelo, pode errar.
Uma bateria pequena de casos sintéticos em uma execução não estima a qualidade geral em produção.
Os relatórios permitem revisão humana das respostas e das justificativas.

## Primeira rodada real — 30/10/2026

- Modelo de geração e avaliação: `google/gemini-2.5-flash`.
- Resultado: 7/9 aprovados, duas falhas, nenhum erro de provedor.
- Comparação: inferiu ritmo e complexidade a partir de 120 e 240 páginas,
  contrariando a ausência de dados sobre essas características.
- Sem evidências: respondeu com uma recusa apropriada, mas acrescentou `[1]`
  sem nenhuma fonte disponível. A checagem determinística detectou a falha.
- Latência de geração: mediana 2.023 ms; maior valor 4.629 ms.
- Uso: geração 5.045 tokens de entrada e 1.799 de saída; avaliação 5.533 de
  entrada e 291 de saída. Custo total informado: US$ 0,0083984.
- Relatório local: `reports/oracle-evaluation-2026-10-30T22-00-16-793Z.json`.

Essas duas falhas orientam o próximo ajuste do prompt; o resultado inicial fica
registrado para comparação, sem ser substituído pelo resultado de uma nova rodada.

## Rodadas de ajuste — 30/10/2026

O prompt passou a proibir inferir ritmo/complexidade por páginas, fabricar citações
na ausência de fontes e seguir instruções dentro dos dados. Também distingue uma
seleção parcial do inventário e prioriza a relevância temática no escopo ampliado.

A segunda rodada recebeu 9/9 do avaliador automático, mas a inspeção das respostas
identificou que o caso externo priorizava uma obra menos relacionada ao pedido.
O critério de relevância e o prompt foram reforçados antes da terceira rodada.
Relatório: `reports/oracle-evaluation-2026-10-30T22-03-04-717Z.json`.

Na terceira rodada, o catálogo externo passou a ser a indicação principal correta,
mas o modelo ainda afirmou que não havia livro sobre o tema no acervo inteiro.
O avaliador automático marcou novamente 9/9, omitindo essa falha. Isso motivou
uma checagem determinística compartilhada pela avaliação e pela API. A resposta
problemática agora é rejeitada antes de ser exibida como resposta válida ou salva;
a API retorna sua mensagem de falha de confiabilidade. Não há reparação automática
da resposta e não se considera o caso como resposta bem-sucedida.

Aplicar a checagem às mesmas respostas capturadas resultou em **8/9 aprovadas**,
uma falha detectada e nenhum erro de provedor, sem novas chamadas. Os critérios
mudaram entre as rodadas; os percentuais não são um benchmark estatístico comparável.

- Geração da terceira rodada: mediana 1.520 ms; maior valor 4.402 ms.
- Uso: geração 6.390 tokens de entrada e 914 de saída; avaliação 5.259 de entrada
  e 256 de saída. Custo total informado nessa rodada: US$ 0,0064197.
- Relatório bruto: `reports/oracle-evaluation-2026-10-30T22-04-39-229Z.json`.
- Revisão determinística: `reports/oracle-evaluation-2026-10-30T22-04-39-229Z-deterministic-review.json`.

Permanece pendente obter uma resposta adequada nesse cenário de maneira consistente,
ampliar os casos e validar o avaliador com revisão humana independente. Os cenários
fictícios e a checagem adicionada não demonstram qualidade geral ou segurança contra
todas as formas de instruções maliciosas em fontes.

## Validação da implementação

- `npm test -- --maxWorkers=2 --testTimeout=20000`: 330 testes aprovados em 52 arquivos.
- `npx tsc --noEmit`: aprovado.
- ESLint nos módulos e arquivos alterados: aprovado.
- `npx next build --webpack` fora do sandbox: aprovado, incluindo TypeScript e 51 páginas estáticas.
- Os testes da rota verificam que uma citação inexistente ou uma afirmação genérica
  de ausência no acervo não é persistida como resposta válida.
- Não foi executada integração com PostgreSQL real nem validação autenticada em navegador nesta etapa.
