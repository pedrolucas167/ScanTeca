# Concorrência e recuperação

## Scraping

Claim, renovação, confirmação, falha e recuperação são scripts Lua atômicos no Redis.
Cada claim incrementa `attempts` e recebe um token e lease de 120 segundos. O worker
renova a cada 40 segundos. Uma consulta à fila recupera até 50 leases vencidos e
promove até 50 retries cujo backoff venceu. Portanto, recuperação requer um worker
ativo consultando a fila; nenhum timer em memória é necessário para manter retries.

O backoff exponencial fica em `scraping:delayed`, limitado a 60 segundos. Claims
antigos em `scraping:processing` sem lease são recuperados gradualmente por HSCAN.
Após esgotar tentativas, o resultado de falha fica retido por 24 horas (a retenção
do hash de resultados segue o contrato anterior). Jobs pendentes não expiram.

A entrega é **at-least-once**, inclusive quando a resposta de um claim se perde.
Tokens impedem um worker antigo de confirmar/falhar uma tentativa nova. Persistência
usa o ID determinístico `scraping_<jobId>` e não sobrescreve um resultado já gravado;
isso impede duplicação do mesmo job após uma queda entre gravação SQL e confirmação
Redis. URLs enfileiradas como jobs diferentes continuam sendo trabalhos distintos.
Não existe transação distribuída entre Redis e PostgreSQL.

Ao atualizar o worker, encerre as instâncias da versão anterior antes de iniciar a
nova: a versão antiga não conhece tokens e não pode participar do protocolo de lease.

### Pontos de entrada da aplicação

`POST /api/scraping/enqueue` agenda uma execução com `after` do Next após retornar
201. Cada callback cria um worker próprio, de modo que requisições concorrentes
disputam os claims no Redis, sem perder agendamentos por um flag local de ocupado.
`GET /api/cron/scraping` executa outro job e também aciona recuperação de leases;
exige `Authorization: Bearer <CRON_SECRET>` (401 sem configuração ou sem credencial).
O cron está declarado em `vercel.json` para 13:00 UTC diariamente. Ambos os handlers
limitam a função a 60 segundos; interrupções são tratadas pelo protocolo de lease.

Backoff representa o instante mínimo para retry, não uma promessa de execução nesse
instante: sem novos enqueues nem worker persistente, retries e backlog avançam no cron
diário, um job por chamada. Para maior vazão, um scheduler externo pode chamar a rota
protegida com frequência maior, ou um processo duradouro pode usar `start()`; não
instale timers de polling em uma função serverless. Esta configuração só entra em
operação depois de revisão e deploy da branch; os testes locais não comprovam que
o cron está ativo em produção.

## Clubes

Entrar, sair e editar um clube usam transação Serializable com até três tentativas
em conflitos P2034. Uma atualização na linha do clube antes das leituras serializa
as decisões de capacidade e permissão. A contagem vem de COUNT, sem carregar toda
a lista de membros. Reduzir maxMembers abaixo da ocupação atual retorna 400;
esgotar os retries retorna 409. Criação continua inserindo clube e dono juntos.

## Recomendações

A rota lê payload e geração juntos antes de gerar recomendações. Publicação compara
o token de geração e grava payload/TTL em um único script. Invalidação troca o token
e remove o payload atomicamente. Tokens aleatórios evitam reutilizar uma versão após
expiração: publicação sem a chave de geração também é rejeitada. Cache dura uma hora;
geração dura duas horas e é renovada em uma publicação válida.

Sem Redis, com falha na leitura ou sem token, a rota gera a resposta sem publicar no
cache. Falhas de publicação/invalidação são registradas e não falham a operação de
negócio, preservando o fallback existente. Uma invalidação que não chega ao Redis por
indisponibilidade de rede não pode garantir frescor entre instâncias; nesse caso,
um payload anterior continua limitado pelo TTL. Não há promessa de atomicidade entre
o commit SQL e a invalidação Redis. Uma resposta já em geração pode refletir o estado
anterior, mas não poderá repovoar o cache após uma invalidação confirmada.

## Testes isolados

Os testes `*.integration.test.ts` usam PostgreSQL em `127.0.0.1:55439`, base
`scanteca_reading_test`, e Redis exclusivo em `127.0.0.1:56379`. Defina
`SCANTECA_TEST_DATABASE_URL` e `SCANTECA_TEST_REDIS=127.0.0.1:56379` antes de
`npm run test:integration`. A CI provisiona ambos. Nunca aponte esses testes para
bases de desenvolvimento compartilhadas ou produção.
