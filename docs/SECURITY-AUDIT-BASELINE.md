# Linha de base da auditoria de dependências

A primeira execução local de `npm run security:audit`, em 27 de outubro de 2026,
reportou **6 achados altos e 1 crítico** nas dependências de produção. O JSON fica
em `reports/security/audit.json`, ignorado pelo Git; o workflow manual preserva o
relatório como artifact. Rode novamente para obter o estado atual.

| Dependência ou cadeia | Prioridade | Encaminhamento |
| --- | --- | --- |
| Next.js 16.3.4 | Crítica | Avaliar a versão corrigida indicada pelo advisory e atualizar o eslint-config-next junto; validar build, autenticação, imagens e rotas |
| Zod | Alta | Atualização compatível e testes de validação de entrada |
| sharp | Alta | Atualizar resolução transitiva e validar processamento de imagens |
| source-map-js | Alta | Atualizar resolução transitiva e validar build |
| Prisma / @prisma/config / deepmerge-ts | Alta | Avaliar correção da cadeia; a sugestão automática inclui migração principal do Prisma e exige revisão própria |

Os achados transitivos da cadeia Prisma contam separadamente no total. Esta
tabela agrupa o trabalho, não altera a contagem do npm. Não foi executado
`npm audit fix --force`. Não trate CI verde ou CodeQL aprovado como resolução
desses achados: revisão de dependências examina mudanças do PR; auditoria da base
existente é uma verificação distinta. As atualizações precisam de commits e PRs
próprios, com validação de compatibilidade antes da integração.

## Estado atual — 28 de outubro de 2026

Após as atualizações de dependências e do Prisma 7.10.1, `npm audit --omit=dev` e
a auditoria completa local não reportam vulnerabilidades. A contagem inicial
abaixo é histórica e descreve a primeira auditoria, antes dessas correções.

## Correções compatíveis — 28 de outubro de 2026

Atualizados Next.js e eslint-config-next para 16.4.3, Zod para 4.6.7 e as
resoluções transitivas de sharp para 0.35.5 e source-map-js para 1.2.2. O lockfile
continua sendo a fonte das versões instaladas; não foi usado `audit fix --force`.

A nova auditoria de produção reportou **zero críticos e três altos**, todos na
cadeia Prisma / @prisma/config / deepmerge-ts. Isso representa a remoção do achado
crítico e de três achados altos da base inicial, não a eliminação de todos os
riscos. A migração Prisma e a atualização da suíte de testes são pacotes próprios.

## Migração Prisma — 28 de outubro de 2026

A atualização coordenada de Prisma, cliente e adapter-pg para 7.10.1 removeu os
três achados restantes na auditoria local de produção: **zero vulnerabilidades
reportadas nesse escopo**. Os achados de desenvolvimento da suíte antiga continuam
separados até a adoção do novo coletor e de sua base aprovada.
Veja [a migração e sua validação](PRISMA-UPGRADE.md).

## Suíte atualizada — 28 de outubro de 2026

Com Vitest/coverage-v8 5.0.5, jsdom 30.1.3 e as resoluções corrigidas de
brace-expansion, a auditoria local **completa**, incluindo desenvolvimento,
reportou zero vulnerabilidades. Essa medição se refere ao lockfile do pacote
de atualização da suíte, que também incorpora a migração Prisma; não descreve
branches antigas ainda em revisão. A mudança do coletor e a base aprovada estão
documentadas em [TEST-STACK-UPGRADE.md](TEST-STACK-UPGRADE.md).
