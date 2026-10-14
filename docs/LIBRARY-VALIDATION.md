# Biblioteca — continuação dos fluxos

13/10/2026. Branch `feat/library-workflows`, criada sobre `feat/reading-journey`.

## Fronteiras

- Scanner, cadastro, enriquecimento, reordenação, coleções, configurações,
  catálogo privado/público e detalhe usam a API pública de Biblioteca.
- As rotas fazem autenticação, rate limiting, parsing e tradução de erros. As
  páginas consultam o módulo; não coordenam persistência dessas operações.
- Metadados puramente textuais continuam em `lib/book-metadata.ts`, sem Prisma.
  Deduplicação e resolução de coleções pertencem ao módulo. O antigo
  `lib/default-collection.ts` é somente uma entrada de compatibilidade.
- Providers de metadados são adaptadores existentes, reutilizados pela aplicação.
  Chamadas de capa, sinopse, data original, scanner, enriquecimento e embeddings
  agora têm timeout por requisição de oito segundos. Cancelamento do chamador é
  preservado quando fornecido.

## Consistência

- Scanner e cadastro manual compartilham `createBook`. Prévia não cria livro,
  coleção nem configurações.
- Criações de um mesmo usuário adquirem advisory lock transacional do PostgreSQL;
  deduplicação por ISBN e título/autor é refeita após adquirir o lock. A transação
  usa ReadCommitted para observar o commit anterior. Lookups externos e embeddings
  ficam fora do lock. Contenção tem limite de três segundos e vira conflito HTTP.
- A unicidade existente ISBN/usuário continua no banco. Livros de usuários
  diferentes não são deduplicados entre si. A heurística título/autor é mantida;
  modelagem explícita de exemplares/edições é uma decisão futura de produto.
- Reordenação verifica propriedade e grava na mesma transação serializável.
  IDs repetidos no pedido são rejeitados antes da execução.
- Renomear biblioteca, mover livros para a coleção correspondente e limpar
  coleções vazias ocorre em uma transação. Falha intermediária desfaz tudo.
- Enriquecimento relê o livro após a consulta externa. Só preenche campos ainda
  vazios, preserva edições manuais e descarta os resultados se título/autor/ISBN
  mudaram. Data original só é aplicada se a data persistida não mudou.
- Indexação é posterior ao commit e condicionada à versão (`updatedAt`). Um
  vetor calculado lentamente não sobrescreve uma edição mais recente. Falha de
  indexação não transforma uma gravação já confirmada em erro de cadastro.
- O enriquecimento invalida o cache a cada livro alterado. Rate limits de
  enriquecimento e ordenação usam suas configurações específicas.
- Catálogo público seleciona explicitamente campos exibidos e reviews públicos,
  sem notas privadas, e respeita a revogação do compartilhamento.

## Validação

- 154 testes unitários passaram em 22 arquivos.
- 23 testes de integração passaram em dois arquivos: 11 de Leitura e 12 de
  Biblioteca, contra PostgreSQL 16 + pgvector descartável.
- Biblioteca verificou cadastros concorrentes por ISBN/manual/scanner, isolamento
  entre usuários, prévia sem gravações, reordenação, renomeação atômica e rollback,
  enriquecimento concorrente, privacidade/revogação e indexação atrasada.
- Build e TypeScript passaram. Lint: zero erros e 21 avisos legados.
- Smoke HTTP com base descartável: catálogo compartilhado 200, nome fictício
  presente e notas privadas ausentes. Enrich/reorder/configurações anônimos 401;
  scanner anônimo foi bloqueado pelo middleware de autenticação com 404.
- Nenhum schema ou dado da base configurada da aplicação foi alterado.

Integração usa a mesma base descartável e o mesmo comando documentados em
[READING-VALIDATION.md](./READING-VALIDATION.md). O job de integração existente
descobre ambos os arquivos; sua execução remota depende de push futuro.

## Limites

Providers externos são substituídos por mocks nos testes: isso verifica o fluxo
e suas falhas, não a disponibilidade/qualidade atual dos serviços. O timeout
limita cada requisição, não o tempo total de um enriquecimento em lote. Lotes
grandes e indexação durável ainda precisam de jobs e retentativas persistentes.

Não houve revisão visual autenticada. APIs de reviews/discussões, recomendações,
rota de leitura, auditoria/backfill de RAG e dados sociais continuam na camada
legada, a migrar nos módulos correspondentes. A aplicação inteira ainda não é
um monólito modular concluído.
