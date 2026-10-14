# Oráculo: streaming e histórico

Primeira etapa do módulo Oráculo, validada em 13/10/2026.

## Mudanças

- O leitor de respostas do provedor está em `modules/oracle/completion.ts` e exige o marcador de conclusão. Resposta truncada, JSON inválido e erro do provedor não são tratados como resposta completa.
- A geração principal respeita o cancelamento da requisição e tem limite de 60 segundos. A atualização opcional de perfil usa o limite padrão de 8 segundos.
- Regenerar mantém a resposta anterior até a substituição transacional. O histórico enviado ao modelo exclui essa resposta sem apagá-la do banco antes da geração.
- A gravação verifica o proprietário da conversa, substitui a resposta e atualiza a sessão na mesma transação. Regenerações concorrentes da mesma resposta permitem uma substituição; a outra falha sem duplicar a resposta.
- Cancelamento ou falha de regeneração restaura a conversa anterior na interface.

## Evidências

- 168 testes unitários passaram, incluindo cinco cenários do leitor de streaming.
- 32 testes com PostgreSQL descartável passaram, incluindo substituição, isolamento entre contas, rollback e concorrência do Oráculo.
- Build de produção e TypeScript passaram. Lint sem erros; a página contém três avisos preexistentes de diretivas ESLint desnecessárias.
- No navegador autenticado, o serviço real identificou o livro fictício em leitura e as 55 de 200 páginas registradas.
- Regenerar funcionou, e reabrir a conversa mostrou a resposta persistida e apenas duas mensagens.
- Cancelar uma regeneração preservou a resposta no banco e, após o ajuste da interface, restaurou-a imediatamente na tela.

## Escopo restante

A modularização do Oráculo não está concluída. Recuperação de contexto, filtros, reranking, montagem de prompts, sessões e artefatos ainda precisam de extração e testes próprios. Conversa casual usa um caminho separado; voz e TTS também precisam de validação de streaming, cancelamento e persistência. Esta rodada não valida microfone, síntese de voz, catálogo externo ou qualidade geral das respostas. A fixture tinha um de quatro livros indexados; o teste de progresso não comprova cobertura semântica de todo o acervo.
