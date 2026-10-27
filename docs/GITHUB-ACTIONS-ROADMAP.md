# Proposta: proteger main e ampliar GitHub Actions

Estado: proposta para revisão, sem ativação de regras ou novos workflows.

## Base verificada

O repositório é público, usa `main` e tem um colaborador. A CI executa `build`,
`reading-integration` e `coverage`, todos emitidos pelo GitHub Actions. Na consulta
da preparação desta proposta, os três checks estavam aprovados na principal.

A última medição confirmada é 17,82% de linhas, com 80,14% em `modules`.
Há 271 testes da aplicação e três do controle de cobertura. A maior lacuna de
cobertura continua nas páginas e componentes. O lint aceita 20 avisos legados.
Deploys continuam no fluxo GitHub → merge em main → Vercel.

## 1. Proteção inicial de main

| Regra | Proposta | Motivo |
| --- | --- | --- |
| Alterações por pull request | Obrigatório | Preservar histórico de revisão e validação |
| Checks obrigatórios | `build`, `reading-integration`, `coverage` | Nomes existentes, já executados com sucesso |
| Origem dos checks | GitHub Actions | Vincular o resultado à integração verificada |
| PR atualizado com main | Obrigatório | Validar a integração com a versão atual |
| Conversas de revisão resolvidas | Obrigatório | Evitar integrar feedback pendente |
| Force push e exclusão de main | Bloqueados | Preservar a branch de produção |
| Aprovação de outra pessoa | Zero inicialmente | Há um colaborador; exigir aprovação externa bloquearia o fluxo individual |
| Bypass permanente | Nenhum | Aplicar o mesmo caminho de PR/CI ao mantenedor |
| Métodos de merge | Merge e squash | Compatíveis com o histórico e Conventional Commits |

Ao adicionar outro mantenedor que possa revisar PRs, propor uma aprovação
obrigatória e reavaliar CODEOWNERS. Assinaturas obrigatórias, histórico linear
e merge queue ficam para uma etapa posterior, conforme o fluxo real da equipe.

O JSON em [main-proposal.json](../.github/rulesets/main-proposal.json) é um payload
de proposta com `enforcement: disabled`. Ele não é um workflow e sua presença no
repositório não cria nem ativa proteção no GitHub. A integração dos checks foi
conferida pela API; o identificador no JSON corresponde ao GitHub Actions.

### Ativação e aceite

1. Revisar o JSON e confirmar os nomes dos checks no PR mais recente.
2. Criar/importar a regra ainda desativada e conferir o alvo `main`.
3. Ativar somente depois da aprovação desta proposta.
4. Em um PR descartável, verificar que check falho ou ausente impede merge;
   com os três aprovados e a branch atualizada, o merge deve ficar disponível.
5. Conferir a regra pela API/UI para confirmar bloqueio de force push e exclusão,
   sem tentar operações destrutivas na principal.

Se houver bloqueio indevido, o administrador pode editar/desativar temporariamente
a regra, registrar a justificativa e restaurá-la depois da correção. Não criar uma
exceção permanente para contornar checks. Essa operação administrativa exige uma
decisão explícita do mantenedor e não deve ser automatizada.

Não renomear os checks nem adicionar filtros de caminhos ao workflow obrigatório
sem coordenar a alteração da regra. Um novo check só se torna obrigatório depois
de existir e passar em uma execução real. A prévia Vercel continua como sinal
adicional nesta primeira fase.

## 2. Expansão das automações

| Ordem | Entrega | Execução proposta | Critério de aceite |
| --- | --- | --- | --- |
| P0 | Robustez da CI atual | PR e push | Timeouts por job; cancelar apenas execuções antigas do mesmo PR; preservar as execuções de main e os três nomes obrigatórios |
| P0 | Actions reproduzíveis | Toda CI | Atualizar actions que ainda usam runtime antigo e fixar referências por SHA completo verificado; permissões mínimas por job |
| P0 | Validação de workflows e PR | PR | Validar sintaxe dos workflows e título Conventional Commits; tratar título/corpo como dados, sem interpolação em comandos shell |
| P1 | Dependabot | Semanal | Atualizações de npm e GitHub Actions agrupadas, com limite de PRs abertos; nenhuma integração automática de dependências |
| P1 | Segurança de código e dependências | PR; análise periódica na principal | Dependency Review para novas dependências e CodeQL para JavaScript/TypeScript; publicar resultados antes de tornar novos checks obrigatórios |
| P1 | Testes de componentes | PR | Exercitar Tab/Escape, foco, envio duplicado, rascunho em falha e estados de notificações sem serviços externos |
| P1 | Testes de navegador | PR | Smoke de visitante no Playwright: apresentação, temas, atalho de conteúdo, feed deslogado e formulários; guardar trace/screenshot só em falha |
| P2 | E2E autenticado | PR com ambiente isolado | Conta de teste dedicada, banco descartável e segredos restritos; nenhum teste de gravação em produção |
| P2 | Conferência pós-deploy | Sucesso de deploy Production | Confirmar o evento de deployment da Vercel, verificar URLs públicas permitidas e registrar resultado no Actions |
| P3 | Releases e changelog | Manual ou por PR de release | Gerar proposta a partir dos Conventional Commits; aprovação humana; manter a Vercel como caminho único de publicação |

### Primeiro lote recomendado

Implementar primeiro a robustez da CI, as referências verificadas das actions e a
validação de workflows. Executar os checks em modo não obrigatório, revisar o
resultado e só então ativar a proteção com os três checks atuais. Depois avançar
para Dependabot/segurança e testes de componentes, que atacam diretamente as
lacunas de cobertura observadas.

Os testes de navegador começam sem autenticação. Login real, permissões de push,
uploads e operações de moderação entram apenas com contas e serviços de teste
explicitamente preparados. Os testes manuais existentes são evidência útil, mas
não substituem a automação desses cenários.

### Regras para as novas automações

- Manter permissões de leitura por padrão. Conceder escrita somente ao job que
  precisar, por exemplo publicar resultados de segurança ou propor uma release.
- Não executar código de PR não confiável com segredos via `pull_request_target`.
- Não reutilizar banco de produção ou credenciais pessoais em testes.
- Usar execução manual nos fluxos novos antes de adicionar agendamento. Não abrir
  issues, enviar mensagens ou habilitar auto-merge sem autorização específica.
- Manter os jobs obrigatórios presentes em todos os PRs; otimizar custo inicialmente
  com cache, cancelamento de execuções antigas e timeouts, não pulando os checks.
- A conferência de produção usa uma lista fixa de domínios permitidos e requisições
  de leitura. Não executar deploy ou rollback automático como parte desse smoke.
- Confirmar a entrega do evento da Vercel antes de depender dele: houve um merge
  recente sem registro imediato de deployment no GitHub.
- Tornar novos avisos de lint bloqueantes só depois de criar um controle que
  diferencie o legado. Não reprovar toda a base por avisos preexistentes sem tratá-los.

## Estado inicial da proposta

Não foram alteradas configurações no GitHub, agendamentos, permissões, secrets ou
automações ativas. Não há novo workflow habilitado nem PR publicado desta proposta.
Os nomes e parâmetros do JSON foram conferidos com a documentação e os checks
existentes; a política ainda precisa ser testada no GitHub após sua ativação aprovada.

## Implantação em 27 de outubro de 2026

Os quatro pacotes foram integrados por PR após aprovação dos checks centrais.
O grafo de dependências foi habilitado e a revisão de dependências passou. O
ruleset real da principal foi ativado e relido pela API, exigindo os três checks,
PR e atualização da branch, com zero aprovações externas. O JSON permanece um
modelo desativado, não uma sincronização automática das configurações remotas.

Os dez cenários públicos de navegador passaram localmente com build de produção.
O workflow de navegador continua manual e aguarda segredos do ambiente `e2e`;
o modo autenticado exige conta exclusiva. Os modos de escrita de release também
aguardam configuração específica. Veja o [guia operacional](CI-DEPLOY-RUNBOOK.md).

## Referências oficiais

- [Regras disponíveis em rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [Criar um ruleset de repositório](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)
- [API de regras e parâmetros](https://docs.github.com/en/rest/repos/rules)
- [Uso seguro de GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use)
