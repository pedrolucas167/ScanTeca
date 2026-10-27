# Etapa 4 — controles e estados de interação

## Mudanças

- Notificações distinguem carregamento, lista vazia e falha com nova tentativa.
  Marcar como lidas só atualiza o estado após confirmação do servidor; erros de
  leitura e de push são apresentados no painel.
- Painel de notificações com estado expandido, contagem acessível, Tab e Escape,
  retorno de foco e posicionamento dentro da tela no celular.
- Controles revisados de notificações, moderação, composição e ações do feed têm
  área de toque mínima de 44px. O seletor de emojis possui nomes em português,
  estado expandido, fechamento por Escape, saída com Tab e clique externo.
- O compositor preserva o rascunho em falha, anuncia envio e conclusão e impede
  envios simultâneos. Inserir emoji substitui a seleção e respeita o limite de texto.
- Curtidas e salvos anunciam o estado; comentários anunciam expansão. As ações
  assíncronas do post evitam duplicação e exibem falhas sem alterar o estado anterior.
- Imagens do post abrem por botão acessível ao teclado. Validação do arquivo usa
  erro na página. Anexos e citações não mudam durante o envio da publicação.
- A indicação estática de ordem do feed deixa de se apresentar como botão sem ação.

## Validação

- Suíte principal: 197 testes aprovados em 30 arquivos, incluindo nove novos
  casos de notificações (vazio, HTTP 401/500/503, conexão, resposta inválida,
  cancelamento e confirmação/rejeição de leitura).
- Integração: 68 testes aprovados em nove arquivos com PostgreSQL e Redis reais,
  nas portas locais exclusivas previstas pela CI. Ambos os containers descartáveis
  foram encerrados após os testes, sem alterar outros containers.
- Lint: zero erros; 20 avisos em arquivos legados.
- Build de produção aprovado, incluindo TypeScript e geração das páginas.
- Navegador, em página temporária sem gravação externa: envio, sucesso, falha,
  preservação do rascunho, Ctrl+Enter, bloqueio durante envio, Tab/Escape,
  retorno de foco, seleção de texto e limite de 1.000 caracteres com emoji.
- Navegador, com sessão de desenvolvimento e banco descartável: feed carregado,
  curtida, salvar, comentário persistido, notificação carregada e leitura em lote.
  Um trigger temporário simulou falha de gravação de curtida: a tela exibiu erro
  e preservou o estado anterior. O trigger foi removido após a verificação.
- Em 320px, painel de notificações entre 12px e 308px; painel de emojis entre
  24px e 280px. Botões de emojis medidos em 44 × 44px.
- Páginas e fixtures temporárias removidas antes do build e do commit.

## Limites

Não houve teste com leitor de tela real, ativação de Web Push, upload para S3,
fluxos reais de denúncia/bloqueio/exclusão ou emulação de movimento reduzido.
A interface do navegador disponível não oferece emulação de mídia; a regra CSS
de movimento reduzido da etapa 3 permanece sem essa validação de sistema.
Os testes de navegador e integração usaram armazenamento descartável, não produção.
