# CI, testes e publicação

## Clone novo

Use Node.js 24 e o lockfile versionado. Execute `npm ci`; não atualize dependências
para conseguir instalar. Copie `.env.example` para um arquivo local ignorado e
preencha somente os serviços necessários ao trabalho. Nunca versione `.env`.

Os checks regulares são `npm run lint`, `npx tsc --noEmit`, `npm test` e
`npm run build`. A integração e a cobertura combinada precisam de PostgreSQL e
Redis descartáveis; siga [o guia de validação](READING-VALIDATION.md)
e a configuração em `.github/workflows/ci.yml`.
Não use o banco de produção para testes ou `prisma db push`.

## Checks de pull request

`build`, `reading-integration` e `coverage` são os checks centrais. O relatório
combina as duas suítes e reprova dados ausentes e regressões abaixo dos limites
versionados. `workflow-policy` verifica títulos Conventional Commits, permissões,
timeouts e referências imutáveis das actions. CodeQL e revisão de dependências
complementam esses controles. Falhas devem ser investigadas antes do merge.

A revisão de dependências exige o grafo de dependências ativo nas configurações
de segurança do GitHub. Sua ativação e os alertas foram confirmados durante a
implantação destes workflows. Não use `continue-on-error` para ocultar uma falha
de configuração. O workflow manual de auditoria publica achados existentes em
modo informativo; isso não significa ausência de vulnerabilidades.

## Navegador isolado

O workflow Browser tests começa manual, no ambiente `e2e`. Cadastre nesse ambiente
somente chaves de uma instância Clerk de desenvolvimento:

| Secret | Conteúdo |
| --- | --- |
| `E2E_CLERK_PUBLISHABLE_KEY` | Chave pública de desenvolvimento |
| `E2E_CLERK_SECRET_KEY` | Chave secreta da mesma instância de desenvolvimento |

Não envie o arquivo de ambiente inteiro. Os testes recusam chaves de produção,
reutilização de servidor e banco fora do endereço descartável permitido. O modo
autenticado cria uma conta temporária, com email de teste e identificador únicos,
e uma sessão isolada com o helper oficial. Não é preciso cadastrar email fixo ou
manter senha: a senha exigida pela instância é aleatória e existe apenas em memória.
O teste remove a publicação e a conta que ele próprio criou, inclusive se falhar.

Localmente, mantenha Docker ativo, rode `npm ci` e depois **`npm run test:e2e:auth`**.
O comando valida as chaves de desenvolvimento, sobe PostgreSQL isolado, prepara o
schema, instala Chromium se necessário, gera o build de produção e executa o
cenário no mesmo modo da CI. A geração do build leva mais tempo que o servidor de
desenvolvimento, mas evita interferência de recarregamentos durante o login. Ao terminar, encerra
somente seu próprio projeto Docker e descarta o banco, mesmo em falha normal.
Os três cenários autenticados e os limites dos providers estão em
[AUTHENTICATED-E2E.md](AUTHENTICATED-E2E.md).
Não exige exportar URLs ou instalar a CLI do Clerk. A porta local 55439 deve estar
livre; um serviço existente nessa porta não é removido nem reutilizado.
As chaves locais são lidas sem importar URLs de banco ou integrações do `.env`.
O isolamento usa `compose.e2e.yml`, com armazenamento temporário em memória.

Na CI, abra **Actions → Browser tests → Run workflow** na `main`. O cenário
autenticado vem selecionado por padrão; desmarque-o para rodar somente os dez
cenários públicos. A preparação do Clerk acontece no mesmo worker do teste, sem
arquivos de sessão compartilhados. O ambiente `e2e` deve permitir somente a branch
`main`; os dois secrets devem ser cadastrados nesse ambiente, não no código.
Isso impede que uma execução de branch não revisada receba essas credenciais.

Um encerramento forçado pode impedir o teardown do processo. Nesse caso, confira
o projeto Docker criado por essa execução e a conta marcada com
`privateMetadata.scantecaE2E`, usando o identificador da execução. Remova somente
esses recursos; não há rotina automática que apague contas por prefixo ou varra
usuários da instância.

O helper oficial autentica por um ticket de curta duração. O cenário valida a
sessão e as operações autenticadas da aplicação; não substitui testes específicos
dos formulários de senha, provedores OAuth ou MFA.

Traces, vídeos e screenshots autenticados ficam desativados. Logs passam por um
filtro de tokens. Somente screenshots de falhas públicas podem ser publicados,
com retenção curta. Não publique estado de sessão ou relatórios com credenciais.

## Merge e deploy

Crie branches por pacote, commits convencionais e PRs com validação e limitações.
Na pilha inicial, integre robustez, segurança, componentes e navegador nessa ordem;
atualize a base de cada PR e confirme novamente os checks antes do próximo merge.
A proteção proposta exige PR, resolução das conversas, branch atualizada e os três
checks centrais. Não exige outra pessoa para aprovar enquanto o projeto tiver um
único colaborador. O arquivo `.github/rulesets/main-proposal.json` é uma proposta
desativada para revisão/importação. Em 27 de outubro de 2026, o ruleset real foi
ativado pela API e conferido: PR obrigatório, resolução de conversas, branch
atualizada, bloqueio de exclusão e force push e checks `build`,
`reading-integration` e `coverage`, sem exigir outro aprovador.
Confira o estado atual nas configurações do repositório antes de alterá-lo.
O pacote de proteção de segredos acrescenta o check `secrets` ao modelo; sua
exigência é ativada após validar o workflow no GitHub e integrar o pacote.

Merge na `main` aciona a integração existente com a Vercel. Não execute deploy
manual como atalho. Confirme o deployment de produção referente ao commit integrado;
preview pronta ou CI verde não comprovam publicação em produção. Se não aparecer,
investigue a integração, o projeto e a branch de produção na Vercel.

O smoke pós-deploy usa somente GET em quatro rotas públicas de um domínio fixo.
Pode ser iniciado manualmente e pelo evento de deployment de produção concluído.
Ele não altera dados, não publica outra versão e não executa rollback. Uma falha
exige inspeção; eventual reversão deve ser decidida pelo mantenedor.

## Releases

Release proposal inicia em modo `plan`, sem escrita. Os modos de criação de PR e
publicação exigem a `main`, o ambiente `release` e `RELEASE_PLEASE_TOKEN` dedicado,
restrito ao repositório, com as permissões necessárias de conteúdo, issues e PRs.
Use proteção de ambiente e expiração do token. O token padrão do Actions não
substitui esse cadastro: eventos gerados por ele normalmente não iniciam a CI de
outro PR. Nenhum desses modos mescla PRs automaticamente ou substitui a Vercel.

## Pendências que precisam de configuração

As chaves Clerk não são cadastradas por commit. A execução autenticada na CI exige
os dois secrets de desenvolvimento; a conta é criada automaticamente. Os modos de escrita de release exigem
o token e o ambiente. Mantenha novos checks opcionais até validar seu fluxo real.
Registre a execução e o commit verificado antes de torná-los obrigatórios.
