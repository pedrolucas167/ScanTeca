# Oráculo: modelos gratuitos em desenvolvimento

## Decisão atual — 04/11/2026

O uso gratuito é viável para desenvolvimento de baixo volume, mas **a seleção
de modelos ainda não está aprovada**. A conta consultada informou limite de
50 chamadas gratuitas por dia, 51 contabilizadas e nenhuma restante. Não há
evidência de que seja obrigatório usar modelos pagos; há evidência de que a
cota atual não sustenta uma bateria extensa de avaliações no mesmo dia.

As variáveis e a escolha de modelo em produção não foram alteradas. A rotação é optativa por ambiente:
`ORACLE_FREE_MODELS` contém uma lista explícita de IDs terminados em `:free`.
Sem essa variável, o modelo existente de `ORACLE_CHAT_MODEL` permanece em uso.
O arquivo local ignorado `.env.development.local` mantém provisoriamente apenas
`nvidia/nemotron-3.5-super-vl:free`. Um segundo modelo só entra após avaliação.
Com um único candidato não existe distribuição real entre modelos, embora o
algoritmo e seus testes suportem listas maiores.

## Rotação e limites

- Round-robin por chamada de texto: geração, reescrita, conversa casual e
  aprendizado opcional de memória. A rotação não troca de modelo no meio de
  uma resposta já iniciada.
- Até duas tentativas, exclusivamente gratuitas. Não há fallback pago.
  A requisição também restringe o preço de entrada/saída a zero.
- Erros transitórios e limites explicitamente atribuídos ao provedor pausam
  aquele modelo. Um 429 sem escopo de provedor pausa a chave e interrompe a
  tentativa, sem tentar contornar a cota global com outro modelo ou outra chave.
- Cada tentativa reserva orçamento antes da chamada: padrão de 20 por janela
  móvel de um minuto e 50 por dia UTC. `ORACLE_FREE_RPM` só permite reduzir o
  teto; `ORACLE_FREE_DAILY_LIMIT` permite ajustar o orçamento até 1.000 quando
  a cota real da conta permitir. Configurar um número maior não aumenta a cota
  no OpenRouter.
- Redis coordena cursor, reservas e pausas entre instâncias. Sem Redis, somente
  desenvolvimento/testes usam estado em memória do processo. Modo gratuito em
  produção sem Redis falha de forma fechada. Esta entrega não o habilita lá.
- A contagem local é por chave e cobre estas chamadas de texto; não representa
  uso de outras aplicações/chaves da mesma conta. O limite do provedor continua
  sendo a autoridade. Falhas e tentativas podem consumir cota.
- O benchmark consulta a cota antes de começar e exige orçamento conservador
  para a rodada completa. Sem saldo, registra a consulta e não começa inferências.

O OpenRouter informa cotas globais e também limites por modelo/provedor.
Sua política prevê aumento da cota gratuita após compra acumulada de créditos;
isso não implica que a conta atual já tenha esse aumento. O contador retornado
pela API foi a evidência usada aqui.
Fontes: [limites](https://openrouter.ai/docs/api_reference/limits),
[fallbacks e cobrança do modelo usado](https://openrouter.ai/docs/guides/routing/model-fallbacks),
[catálogo público](https://openrouter.ai/api/v1/models).

Embeddings, STT/TTS, a rota legada de voz, recomendações fora do módulo Oráculo e
moderação têm integrações próprias. Esta mudança torna gratuitas somente as
chamadas de texto listadas acima; não demonstra custo zero da plataforma inteira.
O benchmark não gera embeddings nem chama esses outros serviços.

## Protocolo reproduzível

`npm run eval:oracle:free` prepara PostgreSQL/pgvector e Redis descartáveis,
executa a suíte de integração e valida recuperação/contexto sem chamar modelos.
`npm run eval:oracle:free -- --live` acrescenta chamadas reais exclusivamente
gratuitas, quando houver cota. Somente a chave OpenRouter e a lista de modelos
são lidas dos arquivos locais; nenhuma conexão externa de banco/Redis é usada.
Os containers pertencem à execução e são removidos no `finally`.

O corpus versionado tem seis livros fictícios e um livro de outra conta.
Quatro perguntas cobrem título acentuado sem embedding, comparação entre duas
obras, preferência declarada com limite de páginas e catálogo externo. A busca
PostgreSQL, os filtros, o ranking, o formatador, o prompt e o leitor de streaming
são reais. O catálogo externo é fictício e fornecido explicitamente.

Critérios definidos antes de cada versão da rodada: fontes esperadas e nenhum
livro da outra conta; números de citações válidos, incluindo as fontes esperadas;
títulos e termos exigidos; resposta completa; ausência de afirmações indevidas
sobre o acervo; conclusão em até 15 segundos, com timeout de 30 segundos.
São duas repetições por cenário e slots de rotação. Um slot não garante amostra
do modelo inicialmente preferido: o relatório registra cada tentativa e o modelo
que de fato respondeu. Falha na recuperação é separada de falha do modelo e não
deve provocar uma chamada sem evidências.

Passar essas checagens mecânicas **não comprova fidelidade semântica**. A inspeção
pelo agente identificou erros que o verificador deixou passar; não houve revisão
humana independente. Não se descarta nenhuma rodada reprovada.

## Rodadas e exclusões

| Rodada | Resultado mecânico original | Limites e decisão |
| --- | --- | --- |
| 1: Gemma 26B, Lightning, Liquid | 8/24; 16 erros | Três das oito respostas aprovadas mecanicamente foram reprovadas na inspeção: Liquid transformou coletânea em um conto e afirmou ausência de temas no acervo completo. Os verificadores de ausência foram ampliados; o histórico original foi preservado. |
| 2: Gemma 26B e Lightning com raciocínio opcional desativado | 7/16; 9 reprovações | Lightning inventou títulos e citações em recomendações. Quatro falhas de comparação eram de recuperação, não do modelo. Gemma não entregou resposta nesta rodada por limites. |
| 3: Super VL, Gemma 31B e Xing | 14/24; 1 reprovação, 3 erros, 6 falhas de recuperação | Xing generalizou ausência no acervo externo e teve falhas de streaming. Gemma ficou limitado. Super VL respondeu 13 vezes e passou nas checagens observadas, em três tipos de cenário. |
| 4: Super VL e Ultra após correção da recuperação | 0/16; 16 erros/bloqueios | A cota gratuita terminou. A maior parte dos slots foi bloqueada localmente sem nova chamada. Não é reprovação de qualidade dos dois modelos. |

Liquid, Lightning nessa configuração e Xing saíram da rotação de desenvolvimento
por falhas observadas de fidelidade. Gemma foi retirado por indisponibilidade na
janela do teste, sem concluir que sua qualidade seja ruim. Ultra não foi habilitado
sem amostras válidas. Super VL é candidato provisório: **a comparação real após
a correção e a avaliação completa continuam pendentes da renovação da cota**.

O erro de recuperação detectado era nosso: palavras dentro de títulos viravam
filtros de autor/gênero/ano, e `do` também casava no final de `usando`. A correção
ignora títulos na extração dos demais filtros e exige fronteira de palavra nos
marcadores de autoria. Isso é coberto por regressão; não se atribui esse erro ao
modelo. As novas variações de afirmação de ausência também têm regressões.

Relatórios completos, ignorados pelo Git:

- `reports/oracle-free-benchmark-2026-11-04T06-10-19-260Z.json`
- `reports/oracle-free-benchmark-2026-11-04T06-14-25-702Z.json`
- `reports/oracle-free-benchmark-2026-11-04T06-17-39-639Z.json`
- `reports/oracle-free-benchmark-2026-11-04T06-20-03-653Z.json`

As versões mudaram entre rodadas: diagnóstico de falhas/fragmentos foi ampliado,
raciocínio opcional foi desativado nos candidatos verificados no catálogo e a
recuperação foi corrigida. Os percentuais não são comparação controlada entre
modelos. O catálogo pode mudar; candidatos precisam ser reconferidos antes de
novas avaliações.

## Capacidade e custo para decidir

Com 50 chamadas diárias, o teto teórico de perguntas sem falhas é:

| Fluxo de texto | Chamadas por pergunta | Perguntas/dia, no máximo |
| --- | ---: | ---: |
| Pergunta inicial sem histórico | 1 | 50 |
| Pergunta com reescrita de histórico | 2 | 25 |
| Reescrita + resposta + aprendizado de memória | 3 | 16 |

Tentativas, avaliações automáticas, outras aplicações e usos da conta reduzem
esses números. Nem toda conversa agenda memória; isso depende de histórico e
memória ativa. A conta tem ainda o limite compartilhado por minuto.

Na terceira rodada, as **13 respostas concluídas do Super VL** tiveram mediana
de 966 ms e p95 de 1.406 ms para transporte/geração até o fim do texto, incluindo
fallback quando aplicável. Média de cerca de 926 tokens de entrada e 67 de saída.
É uma amostra pequena, em três cenários; não mede o fluxo completo autenticado,
latência até persistência/primeira exibição, voz nem estabilidade ao longo dos dias.

Preços públicos de texto consultados em 04/11/2026:

| Modelo | Entrada por milhão de tokens | Saída por milhão de tokens | Projeção para 1.000 chamadas com os tokens médios da amostra |
| --- | ---: | ---: | ---: |
| Super VL `:free` | US$ 0 | US$ 0 | US$ 0 em geração de texto, sujeito à cota |
| Gemini 2.5 Flash | US$ 0,30 | US$ 2,50 | cerca de US$ 0,45 |
| Gemini 2.5 Flash Lite | US$ 0,10 | US$ 0,40 | cerca de US$ 0,12 |

Fonte: [preços no catálogo OpenRouter](https://openrouter.ai/api/v1/models).
São projeções aritméticas, **não medições de custo/latência/qualidade desses
modelos pagos**. Os modelos podem gerar quantidades diferentes de tokens.
Taxas de crédito, câmbio, embeddings, voz, reescrita, memória e demais chamadas
não estão incluídos. Nenhuma inferência paga foi feita nesta avaliação.

Conclusão operacional: manter gratuito em desenvolvimento de baixo volume e
comunicando indisponibilidade ao atingir cota. Antes de depender disso para uso
contínuo, concluir os cenários pendentes, revisar semanticamente as respostas e
observar disponibilidade em dias diferentes. Se o volume necessário superar a
cota efetiva ou os modelos elegíveis não mantiverem qualidade/disponibilidade,
avaliar cota gratuita ampliada ou modelo pago com orçamento explícito. Não há
fallback pago automático nem compra de créditos nesta entrega.

## Validação técnica

- 448 testes unitários aprovados.
- 103 testes de integração aprovados em PostgreSQL/pgvector e Redis descartáveis,
  incluindo três testes do script Lua real de rotação, orçamento e pausas.
- Oito cenários autenticados aprovados, incluindo os cinco do Oráculo; Clerk e
  persistência reais, provedor de IA simulado para essas verificações de navegador.
- Build de produção Webpack aprovado, com TypeScript e 51 páginas.
- Lint sem erros; permanecem 17 avisos anteriores fora desta mudança.
- Ferramentas E2E: seis testes aprovados; política de workflows aprovada.
- Depois da correção final, a rodada sem modelo validou as fontes esperadas nas
  oito execuções de recuperação/contexto. Relatório local:
  `reports/oracle-free-benchmark-2026-11-04T06-28-46-260Z.json`.

Isso não aprova o benchmark semântico nem elimina as pendências da tabela.
