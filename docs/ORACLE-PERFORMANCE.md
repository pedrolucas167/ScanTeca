# Desempenho e andamento do Oráculo

Implementado em 30/10/2026 na branch `feat/oracle-quality-roadmap`.
A publicação da aplicação permanece pendente do fluxo de PR, CI e merge.
Esta etapa não exige nova migração do banco.

## Comportamento

A consulta fundamentada confirma a sessão e a pergunta recebida antes de buscar
contexto. Eventos SSE indicam contexto, busca, catálogo externo, geração,
validação e persistência conforme cada etapa é executada. A interface anuncia
o andamento com uma região de status acessível e mantém o cancelamento disponível.

O texto continua retido até a conclusão do provedor, validação das fontes e
gravação atômica da resposta. Progresso antecipado não significa exibir tokens
sem validação. Falhas depois do início do SSE chegam como evento de erro;
autenticação, validação e propriedade da sessão continuam verificadas antes
do stream, com seus respectivos códigos HTTP.

O aprendizado opcional do perfil passa a executar por `after`, após a resposta,
com limite próprio de oito segundos. Falhas, cancelamentos e respostas rejeitadas
não autorizam essa tarefa. O controle de versão do perfil continua protegendo
edições manuais. `after` depende do tempo permitido pela hospedagem e não é uma
fila durável.

Uma nova tentativa só substitui a última resposta se a última mensagem persistida
for de assistente. Se uma pergunta ficou sem resposta após falha, a tentativa
preserva as respostas anteriores e não duplica essa pergunta.

## Diagnóstico

Ative `PERFORMANCE_DIAGNOSTICS=1` para registrar `oracle-performance` no servidor.
O registro contém duração total do pipeline, resultado, tempos por etapa e uso
numérico informado pelo provedor. Não inclui identificadores, perguntas,
respostas, fontes, cabeçalhos ou credenciais.

As etapas medidas são contexto, reescrita, embedding, recuperação, catálogo
externo, geração, validação e persistência. Segmentos da mesma etapa são somados.
O total começa após autenticação, transcrição e persistência da pergunta;
portanto não representa toda a latência HTTP. Uma etapa ainda pendente quando
ocorre timeout pode não constar do registro final. As durações não devem ser
interpretadas como uma divisão exata, sem sobreposição, do tempo total.

Tokens de entrada, saída e custo em dólares são registrados apenas quando
informados para reescrita, embedding e geração. Valores ausentes permanecem
desconhecidos; contagens cumulativas de streaming não são somadas novamente.
Transcrição, voz, aprendizado posterior do perfil e catálogo externo ficam fora
desse custo. Cancelamento pode ocorrer antes do registro final de uso, mesmo
havendo cobrança. As métricas não demonstram economia financeira.

O suporte à contabilização segue a documentação de
[uso do OpenRouter](https://openrouter.ai/docs/cookbook/administration/usage-accounting)
e de [streaming](https://openrouter.ai/docs/api_reference/streaming), incluindo o
frame final de uso antes de `[DONE]`.

## Cancelamento e limites

O pipeline tem orçamento de 60 segundos. Cancelamento e timeout propagam o sinal
para chamadas de geração, embedding e catálogo externo. Uma consulta ou gravação
Prisma já iniciada pode terminar; checkpoints impedem iniciar as etapas seguintes
após o cancelamento. Não há promessa de desfazer uma gravação já em andamento.

Saudações simples, transcrição e síntese de voz não estão instrumentadas por
este pipeline. O andamento é verificado em navegador com respostas SSE locais;
esse teste não mede latência da infraestrutura de produção.

## Avaliação direcionada com provedor real

`npm run eval:oracle -- --live --stream --case profile-preferences` passou em
um cenário fictício, usando `google/gemini-2.5-flash` em 30/10/2026, horário local.

| Medida | Resultado |
| --- | --- |
| Primeiro delta do provedor | 1.271 ms |
| Geração completa | 2.495 ms |
| Geração: tokens de entrada / saída | 817 / 241 |
| Custo informado da geração | US$ 0,0008476 |
| Custo informado, incluindo avaliador | US$ 0,0011325 |

Relatório local ignorado pelo Git:
`reports/oracle-evaluation-2026-10-31T00-51-49-172Z.json`.
O primeiro delta mede a conexão com o provedor; não mede o momento em que o
usuário vê a resposta validada. Uma execução sintética não estima desempenho,
custo ou qualidade geral em produção. O próximo passo é coletar essas métricas
com a aplicação publicada e um acervo representativo.

## Validação local desta etapa

- Suíte unitária: 375 testes aprovados em 58 arquivos.
- Integração PostgreSQL de histórico e perfil: 13 testes aprovados em dois arquivos,
  com banco local descartável e isolamento entre contas.
- Navegador: dois testes aprovados, desktop e celular, comprovando que o status
  chega antes da resposta final e que o botão de cancelar continua disponível.
- ESLint nos arquivos alterados: aprovado sem avisos.
- Build `npx next build --webpack`: etapas de TypeScript, geração estática e
  coleta de arquivos concluídas; trace final `next-build` registrado.
- Avaliação sintética real com streaming: um cenário aprovado em uma execução.

As execuções não modificaram o banco de produção.
