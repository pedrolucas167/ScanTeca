# Baseline público de desempenho

O Lighthouse mede a página inicial e o Manifesto como visitante, com três
amostras por rota e perfil mobile simulado. O resumo usa a mediana de
Performance, LCP, CLS, TBT e bytes transferidos. As métricas são informativas
nesta fase: a execução reprova se a página ou a coleta for inválida, mas ainda
não impõe orçamento de desempenho.

No GitHub Actions, as PRs executam os testes de validação e privacidade do
relatório e o preflight em páginas fictícias locais, sem secrets. A coleta real roda na `main`, em alterações relevantes ou via
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

O artefato de CI contém `metrics.json`, `summary.md` e, em falha,
`diagnostic.json`, por sete dias. O diagnóstico contém somente etapa, código
de falha, rota esperada e status HTTP; não inclui texto da página, URL de
redirecionamento, mensagens brutas de erro ou credenciais.
Os relatórios brutos e os logs ficam no diretório ignorado
`reports/lighthouse-run-*` da máquina que executou a coleta. Não compartilhe
esses arquivos brutos: podem incluir dados de navegação. Nenhuma etapa envia
relatórios ao serviço de upload do Lighthouse.

O lockfile da ferramenta fixa `basic-ftp` em uma versão corrigida para o
[GHSA-c475-qrg2-pj4r](https://github.com/advisories/GHSA-c475-qrg2-pj4r).
Remova o override quando a cadeia de dependências aceitar a versão corrigida.

Essa medição não representa a latência da Vercel, o catálogo autenticado nem o
comportamento sob carga. Compare execuções do mesmo ambiente antes de propor
limites e repita medições fora da faixa esperada.

## Investigação das falhas — 15/11/2026

O histórico consultado contém três falhas recentes: 08/11, 11/11 e 15/11.
As duas primeiras emitiram somente uma mensagem genérica; a última identificou
`browser-preflight`, sem registrar qual navegação ou condição falhou. Não é
possível atribuir retrospectivamente uma causa única às três execuções.

A checagem anterior lia o primeiro texto do `h1` após `domcontentloaded`, sem
esperar que o conteúdo ficasse pronto. Uma página fictícia com título tardio
reproduz essa reprovação. O preflight agora espera um único título visível com
o marcador esperado; erro HTTP, destino diferente e título inválido continuam
reprovando. A navegação não é repetida automaticamente para esconder falhas.

Os códigos publicados distinguem timeout/falha de navegação, status HTTP,
destino inesperado e título ausente/incorreto. A inicialização do Chromium tem
etapa própria (`browser-launch`). Assim, uma nova falha permite investigar a
condição concreta sem publicar logs privados. A hipótese de título tardio
é testada, mas não foi comprovada como causa da falha histórica em produção
do workflow; essa execução mede um servidor descartável, não a Vercel.
