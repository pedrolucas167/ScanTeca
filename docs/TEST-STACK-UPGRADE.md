# Migração da suíte e do coletor de cobertura

Comparação de 28 de outubro de 2026, com os mesmos **213 testes principais e 68 de
integração**, incluindo os mesmos **208 arquivos de aplicação**. Não houve mudança
de comportamento da aplicação neste pacote.

| Métrica | Vitest 3, CI do pacote de segurança | Vitest 5, execução local |
| --- | --- | --- |
| Linhas | 19,28% — 3890/20169 | 24,61% — 1569/6375 |
| Statements | 19,28% — 3890/20169 | 23,74% — 1749/7366 |
| Funções | 62,20% — 237/381 | 18,75% — 265/1413 |
| Branches | 70,41% — 1116/1585 | 21,14% — 1271/6010 |

O coletor novo usa remapeamento baseado na árvore sintática, ignora linhas sem
código executável e identifica mais funções e condições nos arquivos não testados.
Isso não representa remoção de testes nem ganho equivalente de cobertura. Não
compare os percentuais como uma série contínua entre os dois métodos.

O pacote alinha Vitest e coverage-v8 em 5.0.5, jsdom em 30.1.3 e tipos do Node em
24, correspondentes ao runtime já usado. As configurações são ESM com caminhos
explícitos. A opção removida `coverage.all` sai; os padrões `coverage.include`
continuam incluindo os arquivos não importados pelos testes. As correções
transitivas de brace-expansion foram aplicadas pelo lockfile sem overrides.

**Os limites antigos não foram alterados nesta preparação.** O gate reprova funções
e branches com os novos números. A adoção de uma base correspondente ao coletor
novo depende da decisão sobre essa migração; não integrar este pacote com o gate
desativado ou reduzindo limites sem registrar a mudança de método.

Validação: as duas suítes passaram com PostgreSQL e Redis descartáveis, sem chamadas
reais a IA. TypeScript passou. Os containers foram encerrados após a execução.

Referências: [migração do coletor no Vitest 4](https://v4.vitest.dev/guide/migration#v8-code-coverage-major-changes)
e [migração para Vitest 5](https://vitest.dev/guide/migration/).
