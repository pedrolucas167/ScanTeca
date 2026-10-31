# Personalização controlável do Oráculo

Implementação local de 30/10/2026, na branch `feat/oracle-quality-roadmap`.

## Comportamento

Em Ajustes da conversa → Minha memória, o leitor pode conferir e editar o perfil,
pausar o aprendizado das próximas conversas e apagar a memória. A janela carrega
o estado atual do servidor a cada abertura e confirma a gravação com os dados
retornados pelo servidor. Falhas preservam o rascunho.

Pausar o aprendizado mantém as preferências salvas em uso nas recomendações.
“Apagar memória e pausar” remove o perfil e desativa o aprendizado automático.
As mensagens existentes continuam no histórico; apagar memória não equivale a
excluir conversas. Essas diferenças são explicadas na própria janela.

A janela usa `dialog` nativo, campo com rótulo, fechamento por Escape e retorno
de foco ao controle que a abriu. Durante a gravação, o fechamento fica bloqueado.

## Concorrência e personalização

`LibrarySetting` ganhou `oracleMemoryEnabled` e `oracleProfileVersion`. Os
valores padrão são `true` e `0`, preservando o comportamento anterior na migração.

Cada alteração manual na memória ou na opção de aprendizado incrementa a versão.
O editor envia a versão carregada; uma versão desatualizada recebe HTTP 409,
preserva o rascunho e oferece recarga explícita. Ao recarregar depois de um conflito, o editor mantém
o rascunho e oferece a memória atualmente salva para comparação antes da gravação.
Clientes antigos que omitam a versão continuam aceitos, mas suas alterações também invalidam resultados
automáticos em andamento. Remover o perfil sem informar a opção de aprendizado
pausa o aprendizado por padrão.

O aprendizado foi extraído para `modules/oracle/profile.ts`. Sua gravação exige
o mesmo usuário, aprendizado ainda ativo e a mesma versão de quando a geração
começou. Assim, uma resposta atrasada não sobrescreve uma edição, não recria
uma memória apagada e não compete com outra atualização da mesma versão.

O modelo recebe a mensagem do leitor e o perfil anterior, sem receber a resposta
gerada pelo próprio Oráculo como fonte de novas preferências. O prompt pede
somente preferências e objetivos explicitamente declarados. Respostas truncadas,
vazias, inalteradas ou maiores que 2.000 caracteres não são gravadas.

O prompt de recomendações pede uma explicação que ligue uma preferência declarada
à evidência do livro. Um cenário fictício de preferência por natureza e leituras
de até 150 páginas aprovou a indicação de Jardins da Maré, com 120 páginas e tema
ambiental, citando a fonte.

## Migração e validação

A validação inicial usou o PostgreSQL descartável, em
`127.0.0.1:55439/scanteca_reading_test`. A migração
`prisma/migrations/20261030230000_oracle_memory_controls/migration.sql`
foi posteriormente aplicada em produção, conforme o registro abaixo.

Os testes incluem a aplicação do SQL em uma tabela com perfil preexistente,
validando a preservação do conteúdo e os valores padrão, dentro de uma transação
revertida. Também cobrem edição/apagamento durante a geração, concorrência entre
gerações, inicialização sem configurações, isolamento entre contas e conflito
de versões manuais.

Os dois cenários de navegador (desktop e celular) usam respostas de API fictícias;
a persistência e a concorrência são verificadas separadamente no PostgreSQL.

Avaliação real direcionada:

- `npm run eval:oracle -- --live --case profile-preferences`: 1/1 aprovado.
- Modelo de geração e avaliador: `google/gemini-2.5-flash`.
- Geração: 2.153 ms, 817 tokens de entrada e 210 de saída.
- Avaliação: 979 ms, 777 tokens de entrada e 17 de saída.
- Custo informado: US$ 0,0010457.
- Relatório local: `reports/oracle-evaluation-2026-10-30T22-25-01-423Z.json`.

Esse cenário sintético não representa todas as preferências nem valida o
aprendizado automático com conversas reais. A avaliação geral das respostas
e os limites do avaliador continuam em [ORACLE-EVALUATION.md](./ORACLE-EVALUATION.md).

Validação técnica:

- 350 testes unitários em 54 arquivos aprovados; os seis testes do editor foram
  repetidos depois de preservar o rascunho também na recarga de conflitos.
- 78 testes de integração em 11 arquivos aprovados com PostgreSQL e Redis isolados.
- Dois testes de navegador aprovados, em desktop e celular.
- ESLint nos arquivos alterados aprovado.
- Build final `npx next build --webpack` aprovado, incluindo TypeScript e 51 páginas estáticas.

## Migração aplicada em produção

Concluída em **30/10/2026 às 21:34, America/Sao_Paulo**
(`2026-10-31T00:34:11.755Z`). O destino foi confirmado pela API do Neon,
acessada pela CLI oficial: projeto vinculado no arquivo `.neon`, branch
`production`, banco `neondb`. A conferência mostrou que o `.env` local apontava
para a branch `dev`; essa conexão não foi usada para migrar produção.

Antes da execução, a inspeção somente leitura confirmou que a única migração
pendente era `20261030230000_oracle_memory_controls`. A conexão específica de
produção foi resolvida pela CLI Neon e fornecida somente ao ambiente do processo
Prisma, sem ser salva ou impressa. `prisma migrate deploy` aplicou essa migração.

Uma conexão independente confirmou:

- `oracleMemoryEnabled`: booleano, `NOT NULL`, padrão `true`.
- `oracleProfileVersion`: inteiro, `NOT NULL`, padrão `0`.
- Registro concluído em `_prisma_migrations`, com `applied_steps_count = 1`.
- Checksum SHA-256 `c6b5af43dfdf876d9c8333c37ebdbf87b7df7737f8f1e7291abe83d10652fe5d`, igual ao arquivo versionado.
- Nenhuma migração pendente; consultas agregadas confirmaram os padrões nos registros existentes.

Os relatórios locais, ignorados pelo Git, são
`reports/oracle-production-migration-applied.json` e `reports/deploy/results.json`.
O smoke público retornou 200 em `/`, `/feed`, `/manifest.json` e `/favicon.svg`.

Esse registro confirma a atualização do banco. A publicação do código da aplicação
continua pelo fluxo de PR, checks e merge na `main`; a migração não publica a
interface nova por si só.
