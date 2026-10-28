# Próximas melhorias

Plano aprovado em 28 de outubro de 2026. Cada pacote usa branch própria,
Conventional Commits sem coautoria e PR com evidências e limites de validação.
Integração exige os checks da principal; publicação segue pela Vercel.

| Ordem | Pacote | Critério de conclusão | Estado |
| --- | --- | --- | --- |
| 1a | Correções compatíveis de dependências | Remover o achado crítico, manter Next e ESLint alinhados e validar unitários, integração, build e navegador | Integrado; CI aprovada |
| 1b | Prisma e dependências de testes | Tratar os achados remanescentes em pacotes próprios; migração do coletor com comparação documentada e base correspondente aprovada | Prisma em validação; nova base do Vitest aprovada |
| 2 | E2E de Biblioteca, Leitura e privacidade | Cadastrar livro, persistir progresso e comprovar que outra conta não acessa ou altera os registros privados | Três cenários autenticados e teste do formulário passaram localmente; CI pendente |
| 3 | Oráculo | Cancelamento propagado ao provedor, falhas visíveis sem salvar resposta incompleta e encaminhamento claro das ações disponíveis | Pendente |
| 4 | Documentação operacional | Separar o estado atual das evidências históricas, registrar o que cada teste cobre e manter os passos de CI e deploy reproduzíveis | Em andamento |

Os onze cenários de navegador anteriores cobrem dez fluxos públicos e um cenário
autenticado de publicação/remoção no feed. O pacote de E2E acrescenta cadastro,
Leitura e privacidade, descritos em [AUTHENTICATED-E2E.md](AUTHENTICATED-E2E.md).
A cobertura inicial é histórica; os artifacts da CI mostram
o resultado de cada execução. CI verde não substitui a auditoria de dependências.

A configuração de testes permanece isolada: conta Clerk temporária, banco Docker
descartável, sem serviços de IA pagos nem reaproveitamento de sessão pessoal.
Não aplicar migrações ou dados de teste ao banco de produção. Mudanças na
infraestrutura ou no comportamento dos providers devem ter validação própria.
