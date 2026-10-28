# Migração Prisma 7

Atualização coordenada de `prisma`, `@prisma/client` e `@prisma/adapter-pg` para
7.10.1. O objetivo é remover a cadeia vulnerável de deepmerge-ts sem overrides.
O gerador `prisma-client-js`, ainda suportado nessa versão, foi mantido para não
misturar a alteração dos imports de toda a aplicação com a troca de driver.

O endereço do banco sai do schema e passa a `prisma.config.ts`. A configuração
carrega `.env` explicitamente, respeitando variáveis já fornecidas pelo runner.
`generate` funciona sem URL; comandos que acessam o banco exigem endereço explícito.
Não há seleção automática de `DATABASE_URL_UNPOOLED`, para não substituir um
endereço de teste por credencial de produção encontrada no ambiente.

O cliente usa PrismaPg com pool máximo de cinco conexões, timeout de conexão de
cinco segundos e descarte de conexões ociosas após trinta segundos. A validação
TLS do driver não foi desativada. O singleton de desenvolvimento continua em uso.
O exemplo de ambiente explicita `sslmode=verify-full`, evitando depender de aliases
que o driver mudará numa versão principal futura. A conexão configurada também
foi validada com um `SELECT 1`, sem gravação nem exposição de credenciais.
Node.js 24 fica explícito no manifesto, alinhado ao ambiente local e aos workflows.
Seeds e testes reutilizam a mesma fábrica, preservando as guardas de destino.

`npm run db:prepare:test` só aceita o PostgreSQL descartável documentado, instala
pgvector e executa `db push` sem a flag `--skip-generate`, removida no Prisma 7.
Não inclui `--accept-data-loss` nem executa comandos em produção. A geração do
cliente segue explícita em `postinstall` e no build. A instalação foi validada
também sem endereço de banco, como ocorre no job de build antes de sua etapa final.

O Docker de desenvolvimento inicializa a extensão em volumes novos. Bancos já
existentes conservam sua extensão; nenhuma migração de dados ou DDL de produção
faz parte deste pacote. Em um banco local criado fora desse compose, instale
pgvector antes de preparar o schema.

Os testes principais recebem um destino deliberadamente inacessível, evitando
herdar um banco real do shell. Testes de integração exigem a URL local validada.
Há um teste do preparo que recusa host, porta, banco ou parâmetros fora da guarda
antes de iniciar o Prisma.

Referência: [guia oficial de migração Prisma 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7).
