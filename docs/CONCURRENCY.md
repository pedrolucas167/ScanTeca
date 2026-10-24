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

## Clubes

Entrar, sair e editar um clube usam transação Serializable com até três tentativas
em conflitos P2034. Uma atualização na linha do clube antes das leituras serializa
as decisões de capacidade e permissão. A contagem vem de COUNT, sem carregar toda
a lista de membros. Reduzir maxMembers abaixo da ocupação atual retorna 400;
esgotar os retries retorna 409. Criação continua inserindo clube e dono juntos.

## Testes isolados

Os testes `*.integration.test.ts` usam PostgreSQL em `127.0.0.1:55439`, base
`scanteca_reading_test`, e Redis exclusivo em `127.0.0.1:56379`. Defina
`SCANTECA_TEST_DATABASE_URL` e `SCANTECA_TEST_REDIS=127.0.0.1:56379` antes de
`npm run test:integration`. A CI provisiona ambos. Nunca aponte esses testes para
bases de desenvolvimento compartilhadas ou produção.
