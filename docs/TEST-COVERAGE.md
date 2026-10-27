# Cobertura de testes e CI

## O que a medição inclui

O Vitest usa V8 para medir a suíte principal e a suíte de integração. O escopo
inclui todos os arquivos TypeScript/TSX em `app`, `components`, `lib` e `modules`,
além de `middleware.ts` e `instrumentation.ts`, mesmo quando não importados por
um teste. Testes, declarações de tipos, configuração, scripts operacionais,
fixtures Prisma e arquivos gerados ficam fora desse percentual.

Os JSONs das duas suítes são combinados pelo Istanbul por arquivo e posição;
os percentuais não são somados nem calculados como média. A consolidação falha
se as suítes medirem conjuntos de arquivos diferentes ou se faltar um relatório.

Essa métrica não inclui os testes manuais de navegador. Um bom resultado dos
módulos de negócio não significa que as páginas e componentes tenham cobertura
equivalente. Em particular, cobertura de funções/branches não substitui a de linhas
nem demonstra que todos os fluxos de interface foram exercitados.

## Executar localmente

Base inicial combinada, com 208 arquivos no escopo e 265 testes aprovados:

| Métrica | Cobertura |
| --- | ---: |
| Linhas / statements | 17,52% |
| Funções | 60,44% |
| Branches | 68,66% |

Por área, a cobertura de linhas é: `modules` 80,14%, `lib` 37,92%, `app` 8,93%
e `components` 1,69%. Esses números descrevem a base inicial; consulte o artefato
da execução mais recente para acompanhar a evolução. O objetivo seguinte é
cobrir os fluxos de interface e as APIs ainda não exercitadas, aumentando os mínimos.

```powershell
npm ci
npm run test:coverage-tools
npm run test:coverage
```

Para integração, prepare o PostgreSQL e Redis descartáveis descritos em
[CONCURRENCY.md](./CONCURRENCY.md). Na mesma sessão do terminal:

```powershell
$env:DATABASE_URL = 'postgresql://scanteca_test:scanteca_test_local@127.0.0.1:55439/scanteca_reading_test'
$env:SCANTECA_TEST_DATABASE_URL = $env:DATABASE_URL
$env:SCANTECA_TEST_REDIS = '127.0.0.1:56379'
npx prisma db push --skip-generate
npm run test:integration:coverage
npm run coverage:check
```

Nunca aponte a integração para um banco compartilhado ou de produção.
`npm run coverage:report` gera os relatórios sem aplicar os mínimos.

Arquivos locais, ignorados pelo Git e pelo ESLint:

- `coverage/unit/` e `coverage/integration/`: relatórios por suíte.
- `coverage/combined/index.html`: relatório HTML combinado.
- `coverage/combined/coverage-summary.json`: totais e percentuais por arquivo.
- `coverage/combined/summary.md`: resumo legível com divisão por área.

## Controles na CI

O workflow continua executando lint, testes, build e integração real. As duas
suítes agora coletam cobertura e enviam seus JSONs como artefatos. O job `coverage`
aguarda ambos, consolida os resultados, acrescenta uma tabela ao resumo da execução
e publica o relatório completo por 14 dias. O token do workflow só tem leitura.

`coverage-baseline.json` contém os mínimos globais de linhas, statements, funções
e branches, a partir da medição inicial. A CI reprova qualquer métrica abaixo
do respectivo mínimo; dados ausentes ou inválidos também reprovam. O limite não
é atualizado automaticamente. Aumente os mínimos quando novos testes produzirem
ganhos estáveis; reduções precisam ser explícitas e revisadas no diff.

Esse primeiro controle evita queda abaixo da base inicial. Ele não representa
uma meta final de qualidade nem garante que todo novo código tenha testes.
As próximas prioridades são testes de interação das páginas/componentes e metas
progressivas por área. Testes de navegador automatizados ainda não estão na CI.

O lint continua aceitando avisos legados. Tornar avisos novos um erro e exigir
checks no merge por proteção de branch são controles separados. Alterar este
workflow não ativa proteção de branch no GitHub; para isso, configure `build`,
`reading-integration` e `coverage` como verificações obrigatórias na regra de `main`.
