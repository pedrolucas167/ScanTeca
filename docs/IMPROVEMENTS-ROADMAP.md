# Próximas melhorias

Plano aprovado em 28 de outubro de 2026. Cada pacote usa branch própria,
Conventional Commits sem coautoria e PR com evidências e limites de validação.
Integração exige os checks da principal; publicação segue pela Vercel.

| Ordem | Pacote | Critério de conclusão | Estado |
| --- | --- | --- | --- |
| 1a | Correções compatíveis de dependências | Remover o achado crítico, manter Next e ESLint alinhados e validar unitários, integração, build e navegador | Integrado; checks aprovados |
| 1b | Prisma e dependências de testes | Tratar os achados remanescentes em pacotes próprios; migração do coletor com comparação documentada e base correspondente aprovada | Integrado; auditoria atual sem vulnerabilidades e base Vitest 5 integrada |
| 2 | E2E de Biblioteca, Leitura e privacidade | Cadastrar livro, persistir progresso e comprovar que outra conta não acessa ou altera os registros privados | Integrado; 3 cenários autenticados e workflow com build e navegador passaram na principal |
| 3 | Oráculo | Cancelamento propagado ao provedor, falhas visíveis sem salvar resposta incompleta e encaminhamento claro das ações disponíveis | Integrado; build, integração, cobertura, segredos, navegador e smoke de produção aprovados |
| 4 | Documentação operacional | Separar o estado atual das evidências históricas, registrar o que cada teste cobre e manter os passos de CI e deploy reproduzíveis | Estado atual consolidado; smoke e deploy de produção confirmados |

Os onze cenários de navegador anteriores cobrem dez fluxos públicos e um cenário
autenticado de publicação/remoção no feed. O pacote de E2E acrescenta cadastro,
Leitura e privacidade, descritos em [AUTHENTICATED-E2E.md](AUTHENTICATED-E2E.md).
A cobertura anterior do Vitest 3 é histórica. A base atual do Vitest 5 está em
[TEST-COVERAGE.md](./TEST-COVERAGE.md), e a comparação entre coletores está em
[TEST-STACK-UPGRADE.md](./TEST-STACK-UPGRADE.md). Os artifacts da CI mostram o
resultado de cada execução. CI verde não substitui a auditoria de dependências.

A configuração de testes permanece isolada: conta Clerk temporária, banco Docker
descartável, sem serviços de IA pagos nem reaproveitamento de sessão pessoal.
Não aplicar migrações ou dados de teste ao banco de produção. Mudanças na
infraestrutura ou no comportamento dos providers devem ter validação própria.

Na execução integrada do PR de E2E, a implantação Vercel de preview ficou em
falha. A implantação de produção do merge concluiu e o smoke da principal passou;
por isso o erro de preview não afetou a publicação. As duas evidências devem ser
consultadas separadamente.
