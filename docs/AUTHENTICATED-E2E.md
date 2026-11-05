# Cenários autenticados automatizados

O projeto `authenticated` do Playwright cobre dez cenários:

1. Publicar no feed, confirmar sucesso e remover somente a publicação criada.
2. Cadastrar um livro pelo formulário manual, abrir seu detalhe, iniciar uma sessão,
   registrar páginas e confirmar o progresso depois de recarregar o diário.
3. Criar livro e reflexão privados, autenticar outra conta em contexto separado e
   verificar que ela não lê esses dados nem consegue alterar/excluir o livro ou
   editar a anotação. As mutações indevidas precisam retornar 404; o conteúdo do
   proprietário deve permanecer intacto.

4. Oráculo: perguntar com recuperação real, persistir fontes, regenerar sem
   duplicar pergunta, reabrir histórico e guardar artefato que sobrevive à exclusão
   da conversa.
5. Oráculo: duas falhas sucessivas e recuperação pela terceira tentativa,
   preservando a resposta anterior e somente uma cópia da pergunta nova.
6. Oráculo: cancelar durante a geração e verificar, depois do prazo da resposta
   simulada, que nenhuma resposta parcial ou tardia foi persistida.
7. Oráculo: editar/pausar/apagar memória com persistência após reload; provocar
   conflito real de versão e preservar o rascunho antes de carregar/salvar de novo.
8. Oráculo: outra conta não lê/altera/apaga a conversa, não injeta artefato nela
   e não recebe memória/fontes/artefatos do dono pelas APIs. Limpar o histórico e
   editar a própria memória não afeta os dados do proprietário. Regenerar por API
   com ID de sessão alheia e `userId` forjado também recebe 404. Livros de mesmo
   título nas duas estantes produzem fontes somente da conta autenticada.
9. Oráculo: cancelar uma regeneração restaura a resposta anterior na interface;
   mensagens e fontes persistidas permanecem idênticas, inclusive depois do prazo
   do provedor e ao reabrir a conversa após reload.
10. Sem sessão Clerk: doze combinações de método/rota de conversa, histórico,
    artefatos e memória retornam 401, inclusive mutações diretas.

Somados aos dez cenários públicos gerais e aos 14 de interface do Oráculo com
APIs simuladas, são **34 cenários configurados**. Use
`npm run test:e2e:auth` para os dez cenários do projeto autenticado localmente. O comando prepara o
build de produção, banco descartável e Chromium. No GitHub, execute Browser tests
na `main` com a opção autenticada habilitada.

Cada teste cria suas próprias contas Clerk de desenvolvimento. O fixture mantém
somente os IDs retornados por essas criações e tenta remover todas as contas no
teardown, mesmo se uma remoção falhar. Não pesquisa usuários para apagar por
prefixo. Os livros e publicações criados são removidos pelas APIs da aplicação;
o banco do próprio projeto Docker é descartado ao fim do comando.

Clerk, a sessão, as APIs da aplicação e o PostgreSQL são reais. As consultas de
metadados a Open Library, Google Books e Wikipedia são simuladas por um preload
exclusivo do servidor iniciado pelo Playwright. Ele não é importado pelo app nem
usado no build ou deploy normal. Um teste confirma que requisições Clerk e APIs
locais continuam sendo encaminhadas, sem simular autenticação ou persistência.

No modo autenticado, o preload também simula OpenRouter com uma chave fictícia,
sem qualquer chamada paga. Ele exige o endereço exato do PostgreSQL descartável.
Embeddings indisponíveis exercitam fallback de metadados; respostas, falhas e
atraso de geração são determinísticos. Os testes não interceptam as APIs locais
do Oráculo: autorização, recuperação, validação e persistência continuam reais.
O simulador também devolve a estrutura de moderação esperada pelo cenário do feed.
Nenhum desses fixtures é importado pelo app em desenvolvimento/deploy normal.

Execução local de 04/11/2026: **8/8 autenticados aprovados**, depois de corrigir
o formato de moderação do simulador e remover uma espera de conclusão de SSE no
teste de falhas. Não se atribuem essas duas falhas iniciais ao produto. Avaliação
real dos modelos gratuitos é uma rodada separada, documentada em
[ORACLE-FREE-MODELS.md](ORACLE-FREE-MODELS.md).

Execução local de 05/11/2026: **7/7 cenários do Oráculo aprovados**, incluindo
cancelamento de regeneração, fontes isoladas com títulos iguais e doze chamadas
sem sessão retornando 401. O projeto completo terminou em **9/10**: o feed
recebeu 201, mas o texto não apareceu na interface em 15 s. Na primeira rodada,
o feed passou e a suíte também ficou em 9/10 por uma expectativa incorreta no
teste novo de isolamento, corrigida para verificar mensagens apagadas e sessão
preservada. Builds, TypeScript, lint e testes dos fixtures passaram; a análise
de segredos ficou indisponível por ausência de Gitleaks. As duas rodadas
removeram contas e banco temporários. Evidências e limites completos estão em
[ORACLE-VALIDATION.md](ORACLE-VALIDATION.md). Para repetir só o Oráculo, use
`npm run test:e2e:auth -- oracle-authenticated.spec.ts`.
Esse comando também passou isoladamente antes do PR, na branch baseada na
`main`: **7/7 em 1,5 min**, sem retries, com novo banco descartável e teardown
aprovado. A configuração E2E desabilita rotação local de modelos.

Esses cenários não validam câmera física, qualidade dos providers de metadados,
OAuth/MFA, voz/IA paga ou leitor de tela real. Testes de transação e concorrência
continuam na suíte de integração. Nenhum dado de teste é enviado ao banco de
produção. Traces, vídeos e screenshots autenticados permanecem desativados.

O formulário manual também tem teste de componente: os campos podem ser
preenchidos pelos rótulos acessíveis, a falha do servidor é anunciada e os dados
preenchidos não são perdidos nem há redirecionamento indevido.
