# Experiência mobile do Oráculo

O chat passa a ocupar o viewport visível no celular. A navegação e o rodapé
globais são recolhidos somente enquanto a rota do Oráculo está montada; o botão
de voltar ao catálogo mantém a saída disponível. No desktop, a navegação global
continua visível.

## Mudanças

- Cabeçalho compacto com histórico, nova conversa e ajustes. Modo, escopo,
  criatividade, memória e voz ficam no painel de ajustes, que fecha por Escape
  com retorno de foco e por toque fora.
- Mensagens recebem o espaço liberado pelos controles e pela apresentação
  inicial. Fontes ficam recolhidas até serem solicitadas.
- O compositor acompanha `VisualViewport.height` e `offsetTop`, com fallback
  para a altura da janela. Respeita áreas seguras e conserva o zoom do navegador.
- Campo com fonte de 16 px e botões principais de pelo menos 44 × 44 px. Enter
  cria uma nova linha em telas pequenas ou com ponteiro de toque; o botão envia.
  Desktop mantém Enter para enviar e Shift+Enter para nova linha. Composição de
  texto não dispara envio; Ctrl/Cmd+Enter continua disponível no celular.
- Rolagem acompanha a resposta enquanto o leitor está no fim. Ao subir na
  conversa, a posição é preservada e aparece a ação para voltar ao fim.
- Ícones decorativos não fazem parte dos nomes acessíveis dos controles.

## Evidências locais

- 240 testes unitários aprovados, incluindo 11 novos para compositor, ajustes e
  acompanhamento do viewport. Cobertura unitária: 20,05% de linhas, 19,19% de
  instruções, 16,55% de branches e 15,31% de funções. Isso não substitui a medição
  combinada com PostgreSQL da CI; os limites versionados foram preservados.
- Seis cenários de navegador aprovados entre desktop e celular: geometria e
  teclado, rolagem durante resposta e recuperação de falha. Bootstrap e respostas
  são simulados; não há publicação, escrita de dados nem chamadas reais a IA.
- Conferência adicional em 320 × 568 e 700 × 390: compositor visível e ausência
  de rolagem horizontal. Retorno ao catálogo restaura a navegação global.
- TypeScript e ESLint aprovados; o lint mantém 17 avisos preexistentes fora
  deste pacote. Verificação local de segredos aprovada.
- Build de produção aprovado com `npm run build -- --webpack`, incluindo
  geração das rotas e TypeScript. A execução usou banco isolado e integrações
  desabilitadas; os avisos de Redis ausente são dessa configuração de validação.

Os cenários foram incluídos nas duas configurações públicas do Playwright
(`guest-desktop` e `guest-mobile`). Nas primeiras execuções locais, o teste de
falha aguardava o carregamento externo completo ou preenchia o campo antes da
hidratação. A sincronização agora espera o bootstrap da interface, sem sleeps.
Os casos de chat também aguardam o SDK do Clerk carregar e bloqueiam service
workers apenas nesses cenários com respostas HTTP simuladas. Assim, a ativação
da PWA não recarrega o documento durante a escrita nem contorna as rotas
controladas pelo Playwright. Os testes autenticados mantêm sua configuração.

## Limite da validação

A redução do viewport para simular teclado foi testada no Chrome e os eventos de
deslocamento visual têm testes unitários. Teclado nativo, gestos e áreas seguras
de aparelhos físicos iOS/Android ainda precisam de conferência em dispositivo.
Esta alteração trata a interface; a pesquisa e as regras de acesso do backend
mantêm seu comportamento anterior.

## Regressão: fonte principal cortada no celular

O teste inicial de fontes usava um título curto e media somente a largura do
documento. Com um título longo, a coluna implícita da grade podia crescer além
da conversa, que já tinha a rolagem horizontal ocultada pelo layout externo.
O novo caso reproduziu 702 px de excesso na largura interna antes da correção.

A grade agora declara uma coluna com mínimo zero no mobile e os cartões podem
encolher até a largura disponível. Títulos de livros, diário, avaliações e
catálogo externo quebram em linhas, sem reticências; autores e evidências sem
espaços também não aumentam a largura. O selo de status continua independente.

O cenário adicional mede a conversa e cada cartão, em 320, 375, 390, 430, 768 e
1440 px. Também confere fonte raiz ampliada para 20 px e evidência expandida.
Passou em Chromium e WebKit do Playwright. Ele integra os projetos públicos de
desktop e celular já existentes na CI. WebKit simulado não substitui a
conferência em um iPhone físico.
