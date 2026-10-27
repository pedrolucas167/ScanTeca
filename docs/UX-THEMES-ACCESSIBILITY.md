# Etapa 3 — consistência visual, temas e acessibilidade

## Alterações

- As cores semânticas das telas Stitch acompanham a classe de tema e a cor de
  destaque do HTML, assim como o cabeçalho e os formulários Clerk.
- Superfícies, textos, legendas, painéis translúcidos e citações possuem versões
  claras e escuras. Floresta e Terracota usam tons mais escuros nos botões com texto branco.
- Foco visível compartilhado e link inicial para pular o cabeçalho. O alvo recebe
  foco sem adicionar outro landmark `main` às páginas que já possuem um.
- O botão de tema anuncia seu estado. A preferência explícita continua persistida;
  sem preferência salva, mudanças do sistema são acompanhadas. Mudanças do tema
  em outra aba também são sincronizadas.
- O seletor de cores anuncia a opção ativa, fecha com Escape ou ao sair com Tab
  e devolve foco ao acionador ao selecionar uma cor ou pressionar Escape.
- A apresentação pública anuncia a citação selecionada e oculta ícones decorativos
  dos leitores de tela, mantendo o comportamento dos ícones de outras telas.
- A preferência por movimento reduzido limita animações, transições e rolagem suave.

## Validação

- TypeScript sem emissão, ESLint dos arquivos alterados e `git diff --check`.
- Navegador: apresentação pública clara/escura, destaque Floresta em sessão de
  visitante, Tab/Escape no seletor, estado anunciado e foco do atalho de conteúdo.
- Sem rolagem horizontal na apresentação pública em 320, 375, 768 e 1440px.
- Feed autenticado: alternância de tema, composição visual e estado de erro.
- Contraste calculado dos pares sólidos principais: texto claro 16,97:1;
  texto secundário claro 7,41:1; legenda clara 5,51:1; texto escuro 14,42:1;
  texto secundário escuro 10,90:1; legenda escura 7,24:1. Texto branco nos
  botões: Índigo 6,29:1, Vinho 4,70:1, Floresta 5,48:1, Terracota 5,18:1.

## Limites e continuidade

Esta é uma revisão da base compartilhada e dos controles descritos, não uma
certificação de acessibilidade de todas as telas. Os cálculos cobrem pares sólidos;
sobreposições, transparências e cada estado de interação exigem revisão contextual.
A regra de movimento reduzido foi conferida no CSS, sem emulação do sistema no navegador.
Sincronização entre abas e mudanças do sistema foram verificadas no código, sem
teste de interação dedicado. Não houve teste com leitor de tela real.

A fonte de dados do feed estava indisponível localmente; conteúdo social carregado
e fluxos de gravação não foram exercitados. A próxima etapa continua sendo a
revisão dos controles e estados de carregamento, erro e sucesso das telas.
O rótulo acessível de fechar o modal Clerk permanece uma pendência da etapa 2.
