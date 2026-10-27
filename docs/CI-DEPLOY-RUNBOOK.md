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
| `E2E_CLERK_USER_EMAIL` | Conta exclusiva, necessária apenas para modo autenticado |

Não envie o arquivo de ambiente inteiro. Os testes recusam chaves de produção,
reutilização de servidor e banco fora do endereço descartável permitido. O modo
autenticado cria uma sessão isolada com o helper oficial; não reutiliza sessão
pessoal. O teste remove somente a publicação que ele próprio criou.

Para execução local, suba PostgreSQL com pgvector, usuário `scanteca_test`, senha
local `scanteca_test_local`, banco `scanteca_reading_test` e porta **127.0.0.1:55439**.
Defina `SCANTECA_TEST_DATABASE_URL` com essa conexão e use a mesma URL em
`DATABASE_URL` apenas para preparar o schema com `npx prisma db push`.
Instale Chromium com `npx playwright install chromium` e execute `npm run test:e2e`.
As chaves locais são lidas sem importar URLs de banco ou integrações do `.env`.
`E2E_AUTHENTICATED=1` habilita o cenário adicional e exige a conta dedicada.
Encerre os serviços descartáveis após a execução.

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

As chaves Clerk não são cadastradas por commit. O modo autenticado só pode ser
validado após configurar a conta dedicada; os modos de escrita de release exigem
o token e o ambiente. Mantenha novos checks opcionais até validar seu fluxo real.
Registre a execução e o commit verificado antes de torná-los obrigatórios.
