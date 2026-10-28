# Cenários autenticados automatizados

O projeto `authenticated` do Playwright cobre três cenários:

1. Publicar no feed, confirmar sucesso e remover somente a publicação criada.
2. Cadastrar um livro pelo formulário manual, abrir seu detalhe, iniciar uma sessão,
   registrar páginas e confirmar o progresso depois de recarregar o diário.
3. Criar livro e reflexão privados, autenticar outra conta em contexto separado e
   verificar que ela não lê esses dados nem consegue alterar/excluir o livro ou
   editar a anotação. As mutações indevidas precisam retornar 404; o conteúdo do
   proprietário deve permanecer intacto.

Somados aos dez cenários públicos, são **13 cenários de navegador**. Use
`npm run test:e2e:auth` para os três autenticados localmente. O comando prepara o
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

Esses cenários não validam câmera física, qualidade dos providers de metadados,
OAuth/MFA, voz/IA paga ou leitor de tela real. Testes de transação e concorrência
continuam na suíte de integração. Nenhum dado de teste é enviado ao banco de
produção. Traces, vídeos e screenshots autenticados permanecem desativados.

O formulário manual também tem teste de componente: os campos podem ser
preenchidos pelos rótulos acessíveis, a falha do servidor é anunciada e os dados
preenchidos não são perdidos nem há redirecionamento indevido.
