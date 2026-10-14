# Dados para validação manual

Use PostgreSQL local com pgvector e sua conta **Clerk de desenvolvimento**. O seed é separado do legado `db:seed`, que resolve contas automaticamente e pode chamar IA. Para estes fluxos use apenas `db:seed:dev`.

## Preparação (PowerShell)

```powershell
docker compose -p scanteca-development -f compose.development.yml up -d --wait
$env:SEED_DATABASE_URL = 'postgresql://scanteca_dev:scanteca_dev_local@127.0.0.1:55440/scanteca_development'
$env:DATABASE_URL = $env:SEED_DATABASE_URL
$env:DATABASE_URL_UNPOOLED = $env:SEED_DATABASE_URL
npx prisma db push
$env:SEED_USER_ID = 'user_SUBSTITUA_PELO_ID_DA_CONTA_DE_DESENVOLVIMENTO'
npm run db:seed:dev
npm run db:seed:dev -- --apply
npm run dev
```

Obtenha o ID no painel Clerk, na instância de desenvolvimento, em Users. Entre no aplicativo com essa mesma conta. O e-mail sozinho não identifica o proprietário dos registros; não use o ID da instância de produção. Mantenha as chaves Clerk de desenvolvimento no `.env`.

As variáveis acima valem para esse terminal e seus processos filhos. Elas substituem o destino do `.env` durante a execução. Pare o servidor antes de preparar o schema: no Windows, um servidor usando Prisma pode bloquear a regeneração da DLL. Reinicie nesse mesmo terminal para usar o banco local. O schema existente é aplicado somente ao banco local; nenhum dump é necessário.

## Cenários

- Catálogo: quatro livros fictícios com capas SVG locais, um em cada status, distribuídos em duas coleções. Repetir o seed preenche apenas capas ausentes, preservando capas personalizadas.
- Leitura: livro na página 40 de 200 e sessão encerrada; inicie uma nova sessão pela interface.
- Jornada: um livro concluído, atividade no dia anterior à primeira carga e meta 12 em configurações novas.
- Diário: reflexão com página, tags e sessão vinculada; uso no RAG desativado.
- Anotações: comentário associado a uma passagem do livro em leitura.
- Privacidade: notas privadas fictícias; compartilhamento começa desativado em contas novas. Pode ser habilitado pela interface para conferir o catálogo público.

A prévia não se conecta ao banco. `--apply` cria os registros numa única transação, sem chamadas a serviços externos. O destino precisa ser exatamente o banco local dedicado, e o usuário é obrigatório. Não há fallback para `DATABASE_URL` nem seleção automática de conta.

Repetir o seed preserva edições e não reinicia o progresso. A atividade permanece na data da primeira carga; o seed não simula leitura diária. Também preserva configurações e atividade preexistentes. IDs e ISBNs de fixtures são reservados; conflitos abortam a transação, sem mesclar com livros pessoais. Não há comando de limpeza automática.

O volume Docker mantém os dados entre reinícios. Para encerrar o banco preservando os dados:

```powershell
docker compose -p scanteca-development -f compose.development.yml down
```

Esse conjunto cobre Biblioteca e Leitura. Scanner real, IA/Oráculo, envio de notificações e upload precisam de validação específica com os respectivos serviços.

## Validação da implementação

Foram executados 162 testes unitários, quatro testes novos com PostgreSQL descartável, a prévia CLI e o build Next de produção com TypeScript. Os testes de banco cobrem relações, repetição em outro dia, preservação de edições, concorrência, separação por conta e rollback. O lint dos arquivos adicionados passou. O aviso preexistente de migração de middleware para proxy permanece.

A carga ainda precisa ser aplicada com o ID da conta de desenvolvimento para a revisão visual autenticada. Os testes não gravaram no Neon.
