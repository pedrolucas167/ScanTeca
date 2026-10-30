# Avaliação de respostas do Oráculo

## Executar

`npm run eval:oracle` prepara e salva os nove cenários sem consultar o provedor.
Nenhum caso é marcado como aprovado no modo offline.

`npm run eval:oracle -- --live` usa `OPENROUTER_API_KEY` e `ORACLE_CHAT_MODEL`
do ambiente ou `.env`, com até 18 chamadas: uma geração e uma avaliação por caso.
As chamadas usam somente dados fictícios versionados em
`tests/oracle-evaluation-fixtures.ts`, sem ler livros, perfis ou anotações reais.
O script não grava no banco de dados.

O prompt de geração é compartilhado com a rota da aplicação. A avaliação usa
contextos fixos e não verifica recuperação no PostgreSQL, roteamento, histórico,
autenticação ou streaming. O cenário sem evidências avalia o prompt; a aplicação
normalmente desvia esse caso para uma resposta local antes de chamar o modelo.

O avaliador usa `ORACLE_EVAL_JUDGE_MODEL` ou, se ausente, o mesmo modelo de geração.
Verifica relevância, fidelidade e apoio das citações. Validações determinísticas
também verificam referências inexistentes, referências exigidas e menções
esperadas. Um resultado favorável do avaliador nunca sobrepõe uma falha numérica.
Julgamento ausente, JSON inválido, timeout ou resposta truncada contam como erro.
As execuções reais retornam código 1 se houver falha ou erro.

## Relatórios e limites

Os arquivos JSON ficam em `reports/oracle-evaluation-<data>.json`, ignorados pelo
Git. Contêm as perguntas, fontes fictícias, respostas, julgamento, hash do prompt,
latência de cada chamada e uso/custo informado pelo provedor. `missingUsage` e
`missingCost` indicam valores ausentes; totais são somas dos valores disponíveis.
Geração usa temperatura 0,3 e avaliação usa 0. O limite de tokens usa
`ORACLE_MAX_TOKENS` (padrão 800), limitado ao intervalo 200–1600 por chamada.
Não há retentativas automáticas nem seleção da melhor resposta.

Um avaliador automático, especialmente quando usa o mesmo modelo, pode errar.
Nove casos sintéticos em uma execução não estimam a qualidade geral em produção.
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
