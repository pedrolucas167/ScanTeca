# Revisão de atualizações — 05/11/2026

| Atualização | Causa e encaminhamento |
| --- | --- |
| Actions dos workflows de migrations | As referências v7 já eram usadas nos demais workflows. Diff revisado e checks aprovados antes da integração da PR 195. |
| Upstash Redis 1.41.0 | Mudança minor aditiva para pesquisa híbrida e documentação. APIs usadas pela aplicação preservadas; build, integração, cobertura e imagem aprovados antes da integração da PR 192. |
| js-yaml 5.5.0 | O default export ESM foi removido. O checker passou a importar load nominalmente. Quatro testes da política e leitura dos workflows passaram, assim como o CI após combinar com Redis. A falha inicial de segredos foi HTTP 504 no download do Gitleaks, sem achado de segredo; nenhuma proteção foi desabilitada. |
| TypeScript 6.0.3 | A proposta 7.0.2 falhava no typescript-eslint, cujo parser instalado e versão estável mais recente aceitam >=4.8.4 <6.1.0. O alvo foi ajustado para ~6.0.3, com lint e build locais aprovados e sem desativar regras ou checagem de tipos. A integração exige CI completo aprovado. |

O Next.js instalado já oferece verificação por CLI para TypeScript 7. O bloqueio
observado é o parser do lint; não se atribui essa falha ao suporte do Next.js.
O Dependabot mantém atualizações de manutenção de TypeScript 6.0 e ignora versões
>=6.1 até revisar a compatibilidade da cadeia completa. Isso evita recriar PRs
automaticamente para versões que o parser atual rejeita.

Referências oficiais:
- [Migração js-yaml 4 para 5](https://github.com/nodeca/js-yaml/blob/master/docs/migrate_v4_to_v5.md)
- [Versões suportadas pelo typescript-eslint](https://typescript-eslint.io/users/dependency-versions/)

Builds locais usaram URLs de banco e chaves Clerk sintéticas. As integrações do CI
usaram bancos descartáveis. Nenhum dado de produção foi necessário nesta revisão.
As alterações do Lighthouse permaneceram em outra branch e não integram essas PRs.
