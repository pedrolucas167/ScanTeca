# Baseline público de desempenho

O Lighthouse mede a página inicial e o Manifesto como visitante, com três
amostras por rota e perfil mobile simulado. O resumo usa a mediana de
Performance, LCP, CLS, TBT e bytes transferidos. As métricas são informativas
nesta fase: a execução reprova se a página ou a coleta for inválida, mas ainda
não impõe orçamento de desempenho.

No GitHub Actions, as PRs executam os testes de validação e privacidade do
relatório. A coleta real roda na `main`, em alterações relevantes ou via
`workflow_dispatch`, e usa o ambiente `e2e`. Os secrets
`E2E_CLERK_PUBLISHABLE_KEY` e `E2E_CLERK_SECRET_KEY` devem ser da instância
de desenvolvimento. O servidor precisa validar a navegação anônima do Clerk,
mesmo sem criar contas ou fazer login. A chave privada fica no servidor
descartável; o build recebe apenas a chave pública.

Para executar localmente com Docker e Node 24, instale as dependências com
`npm ci --ignore-scripts`,
`npm ci --prefix tools/lighthouse --ignore-scripts` e
`npx playwright install chromium`. Injete as duas chaves Clerk de desenvolvimento
no ambiente do processo, sem colocá-las na linha de comando, e execute
`node scripts/run-lighthouse.mjs`. O Compose usa um PostgreSQL em memória e
uma porta aleatória em loopback. O harness remove os serviços do próprio teste
ao terminar.

O artefato de CI contém somente `metrics.json` e `summary.md` por sete dias.
Os relatórios brutos e os logs ficam no diretório ignorado
`reports/lighthouse-run-*` da máquina que executou a coleta. Não compartilhe
esses arquivos brutos: podem incluir dados de navegação. Nenhuma etapa envia
relatórios ao serviço de upload do Lighthouse.

Essa medição não representa a latência da Vercel, o catálogo autenticado nem o
comportamento sob carga. Compare execuções do mesmo ambiente antes de propor
limites e repita medições fora da faixa esperada.
