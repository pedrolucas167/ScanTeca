# Oráculo: streaming e histórico

## Aceite autenticado isolado — 05/11/2026

A suíte reproduzível está em `e2e/oracle-authenticated.spec.ts`, executada por
`npm run test:e2e:auth`. O runner cria PostgreSQL 16 com pgvector em Docker,
com dados em tmpfs e destino restrito a
`127.0.0.1:55439/scanteca_reading_test`; aplica extensões e o schema, gera o
cliente Prisma, compila com `next build --webpack` e inicia o build na porta
3020. O teardown remove o projeto Docker e seus volumes.

Primeira execução em 05/11/2026: **9/10 passaram**. A asserção adicionada ao
cenário de isolamento esperava lista de sessões vazia após `DELETE /api/oracle`;
o contrato existente remove somente mensagens e preserva sessões/artefatos.
A expectativa foi corrigida para histórico de mensagens vazio, sem alterar o
produto. As verificações anteriores de 404 e de fontes isoladas passaram nessa
execução; a asserção interrompeu o teste antes das verificações finais dos dados
do dono.

Segunda execução: **7/7 cenários do Oráculo aprovados** (seis com sessão Clerk
e um com doze verificações sem sessão), incluindo as verificações finais dos
dados do dono. O projeto autenticado completo terminou em **9/10**, em 2,2 min
de testes, sem retries. O cenário geral de feed, fora do Oráculo, recebeu 201 e
anunciou “Publicação enviada.”, mas não exibiu o texto publicado dentro dos
15 s. Ele havia passado na primeira rodada; a causa dessa divergência permanece
sem diagnóstico e o aceite geral da suíte não é declarado como aprovado.

Os dois builds Webpack passaram. TypeScript, ESLint dos arquivos de testes,
configuração e fixtures alterados, os seis testes de ferramentas E2E e `git diff --check`
passaram. `npm run secrets:scan` não executou a análise: Gitleaks 8.30.1 não
está disponível no PATH; não se registra aprovação dessa checagem.
O teardown das duas rodadas terminou sem erro de exclusão das contas temporárias
e removeu containers e redes Docker, com `down --volumes`.

Para repetir somente o escopo do Oráculo com a mesma preparação e limpeza:
`npm run test:e2e:auth -- oracle-authenticated.spec.ts`.

Revalidação antes do PR: esse comando terminou com **7/7 aprovados em 1,5 min**,
sem retries, na branch `codex/oracle-authenticated-validation`, baseada em
`origin/main`. Build e teardown passaram novamente. A configuração E2E fixa a
estratégia de chat e esvazia `ORACLE_FREE_MODELS` para impedir que configurações
locais de rotação alterem as tentativas determinísticas do fixture. A falha
anterior do feed permanece registrada; ele não participa desta rodada específica.

As contas são criadas na instância Clerk de desenvolvimento (`pk_test_` e
`sk_test_` obrigatórios). O cenário de isolamento usa duas contas em contextos
de navegador separados. Cada fixture apaga somente os IDs que criou; não há
busca nem remoção de usuários preexistentes. Livros, mensagens e preferências
são fictícios. Nenhum banco ou registro de produção participa da rodada.

| Cenário | Verificação de aceite |
| --- | --- |
| Conversa e histórico | Pergunta e resposta persistidas com ID de fonte pertencente à conta; reload e reabertura pela lista real |
| Regeneração | Substituição da resposta sem duplicar a pergunta; conteúdo regenerado persistido |
| Tentativas | Duas falhas de provedor, terceira tentativa aprovada, uma pergunta e resposta anterior intacta |
| Cancelar pergunta | Nenhuma resposta parcial ou tardia persistida após a espera de 11 s, superior ao atraso de 10 s do fixture |
| Cancelar regeneração | Resposta anterior restaurada na tela; mensagens e fontes idênticas antes/depois da espera e reabertura após reload |
| Memória | Conflito real de versão preserva rascunho; editar, pausar e apagar sobrevivem ao reload |
| Artefato | Conteúdo regenerado salvo e conservado com `sessionId: null` depois de excluir a conversa |
| Duas contas e APIs | GET de sessão e home por ID, PATCH, DELETE, POST de pergunta/regeneração e injeção de artefato alheios recebem 404; `userId` forjado não concede acesso |
| Recuperação isolada | Mesmo título nas duas estantes; fontes da resposta da segunda conta contêm seu livro e excluem o ID do livro do dono |
| Dados do dono | Memória/listas sem vazamento; limpar histórico e editar memória da segunda conta preservam mensagens, memória e artefato do dono |
| Sem autenticação | Doze combinações de método/rota de Oráculo, sessões, artefatos e configurações retornam 401 |

Clerk, cookies de sessão, handlers HTTP, recuperação por metadados e persistência
PostgreSQL são reais. As APIs locais não são interceptadas. OpenRouter,
embeddings e metadados externos usam fixtures exclusivos do processo E2E;
OpenRouter recebe chave fictícia e seu fixture exige o banco descartável.
Redis e push ficam desabilitados. Traces, vídeos e screenshots autenticados
estão desativados para evitar captura de credenciais.

Limitações: esta rodada valida o fluxo fundamentado com corpus mínimo, fallback
sem embeddings e respostas determinísticas; não mede qualidade semântica,
custo/latência de IA real, aprendizado automático de preferências, conversa
casual, voz, OAuth/MFA, concorrência ou rate limiting distribuído. A espera de
cancelamento cobre a conclusão atrasada do fixture, sem simular todas as falhas
de transporte. Avaliação representativa, revisão humana e aceite de produção
continuam separados no [roadmap](ORACLE-QUALITY-ROADMAP.md).

## Registro histórico — 13/10/2026

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
