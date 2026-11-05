# CI do histórico de migrations Prisma

O workflow `Prisma migrations` valida PRs sem acessar produção e sem alterar as
proteções de branch. A convenção deste projeto é
`prisma/migrations/AAAAMMDDHHMMSS_descricao/migration.sql`: as versões são
timestamps, não números consecutivos. Intervalos entre datas são normais.

## Diagnósticos no PR

O job `migration-history` roda em todos os PRs e compara os arquivos com o commit
da branch de destino informado pelo evento do GitHub. Não compara apenas com a
branch local do desenvolvedor. Arquivos novos não ignorados também participam
da conferência local; na CI, o checkout corresponde ao conteúdo versionado.

| Problema | Resultado e orientação |
| --- | --- |
| Duas pastas com o mesmo timestamp | Falha; informa a outra pasta e pede versão única |
| Migration integrada editada, removida ou renomeada | Falha; restaurar o arquivo e criar uma nova migration |
| Migration nova anterior ou igual à última integrada | Falha; atualizar a branch e gerar versão posterior |
| Nome/data inválidos, SQL vazio ou ausente | Falha; aponta o arquivo e o formato esperado |
| SQL solto novo em `prisma/migrations` | Falha; colocar em pasta versionada com `migration.sql` |
| Schema alterado sem SQL equivalente | Falha na comparação do banco; gerar a migration faltante |
| SQL inválido ou dependência ausente | Falha ao aplicar; aponta a migration identificada pelo Prisma |

As falhas retornam código diferente de zero e emitem anotações de erro do GitHub
associadas ao caminho do arquivo. O resumo do job explica a ação necessária.
Caracteres de controle em caminhos e mensagens são escapados; conteúdo do PR não
é interpolado em comandos do shell. Diferenças CRLF/LF do checkout são
normalizadas na comparação com Git, sem ignorar outras mudanças de conteúdo.

## Validação SQL isolada

O job `migration-sql` roda quando há novas migrations ou mudança no schema,
e também em disparo manual. Um serviço PostgreSQL 16 com pgvector é criado
para o job, com credenciais fictícias e sem secrets do projeto.

1. Reconstrói um schema-base vazio a partir de `schema.prisma` do commit de
   destino, usando `prisma migrate diff --from-empty --script`.
2. Cria uma baseline sintética apenas na pasta temporária ignorada pelo Git.
3. Aplica essa baseline e as novas migrations reais com `prisma migrate deploy`.
4. Confere `migrate status` e compara o banco com o schema do PR usando
   `migrate diff --exit-code`. Uma diferença reprova o check.
5. Exercita controles positivos e negativos do verificador em PostgreSQL real.
   Esses testes limpam somente o schema do banco descartável dedicado.

A guarda exige `127.0.0.1:55440/scanteca_migration_test`, sem query string ou
fragmento. Não herda `DATABASE_URL` de `.env`; a configuração temporária recebe
somente a URL de teste validada. Não executa `db push`, `migrate reset` ou
`migrate resolve` em qualquer banco do projeto.

## Limites do histórico existente

Há dois SQLs legados versionados diretamente em `prisma/migrations`, fora de
pastas de migrations. Prisma não os executa como parte de `migrate deploy`.
Arquivos já presentes na branch de destino recebem aviso e ficam imutáveis;
novos arquivos nesse formato reprovam o PR. Nenhum SQL histórico foi reescrito.

A baseline de teste vem do schema da branch de destino. Portanto, a aprovação
**não prova replay integral do SQL antigo**, correspondência com a tabela
`_prisma_migrations` de produção, nem migração de dados existentes. Objetos SQL
customizados ausentes do schema, como triggers, podem exigir um bootstrap de
teste explícito em uma evolução futura. Reconciliação histórica e testes com
dados sintéticos representativos são trabalhos separados.

## Execução local

- `npm run test:migrations-tools`: regras e guardas sem banco.
- `npm run migrations:check`: compara com `origin/main`; `MIGRATION_BASE_REF`
  permite informar outra referência Git existente após fetch.
- `npm run migrations:verify`: prepara PostgreSQL temporário com
  `compose.migrations.yml`, valida o SQL e executa testes positivos/negativos.
  Ao terminar, remove somente o projeto Docker criado pelo próprio comando.

Docker deve estar disponível e a porta 55440 deve estar livre. O banco usa tmpfs;
um serviço já existente nessa porta não é removido ou reutilizado. Encerramento
forçado pode impedir o teardown, como em outros runners locais do projeto.

Os checks ficam visíveis, mas não são adicionados automaticamente ao ruleset de
merge. Para torná-los obrigatórios, primeiro valide o workflow no GitHub e use o
job de histórico como gate estável; o job SQL é condicional e pode ser ignorado
em PRs que não alterem schema/migrations.

## Validação local — 05/11/2026

- 11 testes das regras, anotações e guardas aprovados.
- Validação do schema atual contra a base `origin/main` aprovada em PostgreSQL
  descartável, sem migração nova nem alteração no banco do projeto.
- Quatro testes em PostgreSQL aprovados: schema-base sem mudanças, migration
  válida, mudança de schema sem SQL (rejeitada) e SQL inválido (rejeitado com
  identificação do arquivo). Casos negativos são falhas esperadas e verificadas.
- ESLint dos seis scripts, política de workflows e `git diff --check` aprovados.
- Container e rede Docker próprios removidos ao final; nenhum dado de produção
  foi utilizado. Nenhuma regra de branch foi modificada.

O workflow ainda precisa ser publicado e executado no GitHub; a validação acima
é local. Não equivale a uma execução do Actions nem a replay integral do legado.

Referência: [histórico de migrations do Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/migration-histories).
