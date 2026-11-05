# Aplicação em containers

A publicação Vercel permanece independente. O Dockerfile cria uma imagem Node 24
com saída standalone Next.js, assets estáticos e Prisma gerado. Runtime usa usuário
node, sem ferramentas de migrations, fonte completa, .git, .env ou caches locais.
Somente o build Docker habilita standalone; o build Vercel continua como antes.

## Desenvolvimento local

Crie `.env.container.local` (ignorado pelo Git), contendo a chave pública Clerk
de desenvolvimento e sua chave secreta de desenvolvimento. Acrescente somente
as integrações de desenvolvimento que pretende usar. Não use dados de produção.

```sh
docker compose --env-file .env.container.local -f compose.container.yml up --build -d
docker compose --env-file .env.container.local -f compose.container.yml down
```

Acesse http://localhost:3000. PostgreSQL/pgvector não publica porta no host.
O volume `container_database` persiste entre reinícios. `down` preserva seus dados;
não acrescente `--volumes` ao comando do ambiente de desenvolvimento.

O serviço prepare aceita somente o destino interno documentado e cria um snapshot
do schema com extensão vector e Prisma db push, sem aceitar perda de dados.
Isso NÃO é replay do histórico de migrations, que ainda contém SQL legado.
Não use esse serviço em produção. Evolução e baseline de migrations de produção
são um trabalho separado; o runtime não executa migrations automaticamente.

Clerk continua externo. Redis usa Upstash REST: um Redis TCP comum não o substitui.
Sem configuração, caches e limites têm as limitações existentes de fallback.
S3, IA e demais provedores também exigem configuração própria para uso real.
Cron da Vercel não se transfere automaticamente para um servidor Docker.

## Teste reproduzível

```sh
npm run test:container
```

Usa projeto Compose exclusivo por processo, banco em tmpfs, sem arquivos de ambiente
e porta HTTP aleatória em loopback. Compila a imagem e as ferramentas locais,
prepara schema, verifica readiness com banco, assets públicos, usuário sem
privilégios e ausência de .env/.git/chave secreta. Interrompe o banco, exige 503
sem detalhes e verifica recuperação para 200. Encerra somente seu projeto e seus
recursos descartáveis no finally. Não conta como teste de login ou dos fluxos
autenticados: a chave pública padrão é fictícia. Esses cenários mantêm a suíte
autenticada separada existente.

O endpoint público `/api/health` consulta SELECT 1 e responde apenas status e
HTTP 200/503, sem autenticação, conteúdo de usuários ou mensagem de erro.
Não cobre saúde de Clerk, Redis, S3 ou IA. HEALTHCHECK usa esse endpoint.

## CI e GitHub Packages

PRs constroem e testam, com token somente de leitura, sem publicar imagens.
Depois de CI aprovado em push na main, um workflow separado valida a imagem
daquele commit. O gatilho rejeita execuções de PR e repositórios externos.
Uma execução manual na main também permite repetir a validação/publicação.

Configure a variável do repositório `CONTAINER_CLERK_PUBLISHABLE_KEY` com uma
chave **pública** Clerk do ambiente desejado. Ela é incorporada no build Next.js;
mudar a chave pública exige nova imagem. Sem a variável, o teste usa valor
fictício e a publicação é explicitamente ignorada. Nunca configure a chave secreta
como argumento de build ou variável pública. Secrets de runtime entram somente
no momento de executar a imagem.

O job de publicação recebe somente a imagem já testada, com artifact de retenção
de um dia, e usa GITHUB_TOKEN com packages:write. Não recompila nem executa fonte
nesse job. Publica `ghcr.io/pedrolucas167/scanteca:sha-<commit completo>`.
Registre o digest retornado pelo registry para execução imutável. Não há `latest`
nem substituição automática do deployment Vercel. A visibilidade inicial do pacote
é privada; sua alteração é uma decisão explícita do proprietário.

Primeira entrega: tags por commit. Aliases de release, SBOM, attestations,
scanner de imagem e política de exclusão de versões do registry ficam para a
próxima etapa; o scanner OWASP atual cobre manifests, não a imagem base do sistema.
Não há garantia de retenção limitada de imagens GHCR nesta primeira versão.

## Disco e limpeza

O contexto usa allowlist: fontes necessárias, manifests, Prisma e assets; não
envia node_modules, .next, relatórios ou dados pessoais. PRs não armazenam imagens
no registry. Runners hospedados são temporários; nenhum cache Docker é exportado.
No computador local, imagens de teste e cache de build permanecem reutilizáveis.
Confira `docker system df` antes de limpar. A suíte não executa prune global nem
remove imagens ou volumes de outros projetos. Não use limpeza indiscriminada.

## Validação desta entrega

Em 05/11/2026, o teste local terminou com exit code zero: build Next.js 16.4.4 e
TypeScript, preparação do schema, consulta à tabela SocialProfile vazia, readiness
200 → 503 → 200 ao parar/reiniciar PostgreSQL, asset PNG idêntico ao original,
usuário node e ausência de .env/.git/chave secreta no runtime de teste. O projeto
Compose e o banco tmpfs foram removidos ao final. A imagem runtime local tem
102.542.625 bytes (aproximadamente 98 MiB); isso não é o tamanho comprimido GHCR.
Dois testes unitários de readiness passaram, assim como lint e política de workflows.

A primeira tentativa reprovou no asset escolhido, pois o arquivo .txt passava
pelo middleware Clerk. O teste usa agora um PNG público e não simula sucesso de
autenticação. O build também mostrou aviso de OpenSSL ausente, corrigido pela
instalação explícita. Compose passou a receber env-file temporário vazio para
não carregar implicitamente o .env do usuário. A repetição aprovada usou apenas
a chave pública fictícia documentada.

A execução [Application container](https://github.com/pedrolucas167/ScanTeca/actions/runs/42036557601)
aprovou o smoke real no runner Linux; o job publish foi ignorado, como esperado
para uma PR. A análise ShellCheck/actionlint reprovou duas construções do script
de publicação (atribuição junto com export e crases literais no printf). Ambas
foram corrigidas sem desabilitar regras. A [repetição da política](https://github.com/pedrolucas167/ScanTeca/actions/runs/42036922731)
passou, assim como a [repetição do container](https://github.com/pedrolucas167/ScanTeca/actions/runs/42036922726)
e build, integração e cobertura do CI.

A variável pública de publicação foi configurada com a chave Clerk de
desenvolvimento já usada nos testes; nenhuma chave privada foi enviada ao
GitHub nem incorporada na imagem. Até este registro, nenhum push no GHCR foi
executado ou comprovado. O primeiro pacote depende de integração na main e de
uma nova validação com a chave pública configurada. A primeira publicação do runner hospedado será Linux amd64; builds
multiplataforma, login autenticado na imagem e deployment Docker não foram validados.
