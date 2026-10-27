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
