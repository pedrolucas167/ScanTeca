# Carga inicial do Catálogo

## Comportamento

A consulta inicial seleciona somente os campos necessários para navegação, busca, filtros, ordenação e estatísticas. Sinopses, notas e metadados usados apenas na edição não são selecionados nem enviados nessa carga.

Prateleira, lista e grade renderizam os primeiros 24 resultados. O botão Mostrar mais livros acrescenta outros 24. A pilha semanal mantém seu limite anterior de seis livros. A busca e as estatísticas continuam usando os resumos do acervo completo; arrastar para ordenar mantém o conjunto filtrado completo.

Editar busca os detalhes do livro antes de abrir o formulário. Uma falha impede a abertura de um formulário incompleto, evitando sobrescrever sinopses ou notas com valores vazios. Uma nova seleção cancela a busca de edição anterior. Após salvar, somente o resumo volta para o estado da lista.

A exportação busca os detalhes completos sob demanda e mantém todos os resultados filtrados na ordem escolhida, incluindo livros ainda não renderizados. O endpoint exige autenticação, aplica rate limit e filtra todas as consultas pelo usuário da sessão. Suas respostas de dados são privadas e não armazenáveis em cache compartilhado.

Este primeiro pacote limita a renderização e reduz a largura da consulta; não implementa paginação do banco. A quantidade de resumos ainda cresce com o acervo. Paginar a consulta exigiria mover também filtros, ordenação e agregações para o servidor e tem escopo próprio.

## Comparativo reproduzível

Execute `npx vitest run --config vitest.catalog-performance.config.ts`. O teste usa o componente anterior obtido do Git na revisão `20246c508e228d4efe97598926811b961026d17f`. É possível selecionar outra revisão compatível pela variável `SCANTECA_CATALOG_BASELINE`.

São usados os mesmos acervos sintéticos, sem chamadas externas: 24, 200 e 1.000 livros com sinopses e notas fictícias. Há aquecimento de ambas as implementações e cinco pares medidos por cenário. O relatório é salvo em `reports/catalog-performance.json`, ignorado pelo Git.

| Livros | Renderização anterior, mediana | Renderização nova, mediana | Livros renderizados antes/depois | Dados dos livros antes/depois, sem compressão |
| --- | --- | --- | --- | --- |
| 24 | 92,92 ms | 99,16 ms | 24 / 24 | 42.595 / 6.777 bytes |
| 200 | 811,92 ms | 105,18 ms | 200 / 24 | 363.456 / 56.826 bytes |
| 1.000 | 1.839,51 ms | 84,51 ms | 1.000 / 24 | 1.839.041 / 285.211 bytes |

Com 1.000 livros, o HTML do componente caiu de 1.440.370 para 45.792 bytes; comprimido com gzip, de 23.779 para 3.500 bytes. O conjunto dos livros comprimido caiu de 41.170 para 20.616 bytes. Os textos sintéticos repetidos comprimem bastante; textos reais podem se comportar de outra forma.

Limites: o ensaio mede somente os dados de livros serializados e a renderização real do componente no servidor. Não mede consulta ao banco, layout, rede, imagens, hidratação ou navegação autenticada em produção. As medianas variam com a carga da máquina. O cenário de 24 livros não apresentou ganho de renderização; o ganho de volume permanece. Não há garantia de aceleração de toda visita nem percentual global de melhora da aplicação.

## Validação

- 267 testes unitários passaram, incluindo renderização limitada, busca além da primeira página, edição sem perda de notas, erro de detalhes e exportação completa/filtrada.
- 13 testes de Biblioteca passaram com PostgreSQL descartável real, incluindo seleção sem textos e isolamento das consultas de detalhes entre contas.
- Lint: zero erros e 17 avisos preexistentes fora dos arquivos alterados.
- Build de produção e TypeScript passaram.
- Os três cenários autenticados de navegador passaram com conta temporária de desenvolvimento e banco descartável: publicação, cadastro/progresso com edição sob demanda e privacidade entre contas. O cenário de privacidade também verifica o novo endpoint.

Na primeira execução, um teste preexistente de cadastro manual excedeu seu limite quando a suíte rodou em paralelo com build e lint. A repetição da suíte completa com quatro workers passou sem alteração de timeout ou do teste antigo.

Nenhuma dependência ou schema foi alterado. A falha conhecida dos previews por ausência de configuração de banco e autenticação continua separada dos resultados de compilação e testes.
