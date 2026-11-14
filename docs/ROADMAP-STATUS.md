# Roadmaps: prioridades atuais

Reconciliado em 14/11/2026 com a `main` até o merge do
[PR de busca de lugares de leitura](https://github.com/pedrolucas167/ScanTeca/pull/228).
Este índice prevalece sobre ordens e estimativas históricas dos roadmaps.
Uma entrega implementada não equivale ao aceite de todas as suas integrações.

## Escopo de encerramento

Por decisão do responsável em 14/11/2026, **câmera e scanner físico são
opcionais e não bloqueiam o encerramento dos roadmaps**. O recurso existente
não foi removido; sua validação em aparelho fica para uma retomada específica.
Voz, uploads e push continuam com os critérios próprios abaixo.
Automação de escrita de releases também permanece opcional.

## Entregas concluídas

- Pacote principal de melhorias: dependências, base de testes, E2E de
  Biblioteca/Leitura/privacidade, cancelamento do Oráculo e documentação
  operacional. Evidências em [Melhorias](IMPROVEMENTS-ROADMAP.md).
- Modularização do fluxo fundamentado do Oráculo e dos recursos de sessões e
  artefatos. O aceite local registrou sete cenários do Oráculo aprovados com
  sessão real, banco descartável e IA simulada. Isso inclui persistência,
  cancelamento, memória e isolamento entre contas; não é uma pendência de
  implementação de autenticação. Veja [Validação](ORACLE-VALIDATION.md).
- Pesquisa externa, pedidos naturais de capas, prioridade ao conhecimento
  literário e busca de lugares de leitura com localização opcional foram
  integrados e publicados nos PRs 225 a 228. CI e smoke público passaram;
  esses resultados não comprovam o fluxo autenticado em produção.
- Proteção da principal e pacotes iniciais de GitHub Actions foram implantados.
  A proposta original permanece como histórico, conforme
  [o runbook](CI-DEPLOY-RUNBOOK.md).

## Pendências em ordem de prioridade

| Ordem | Frente | Trabalho restante e evidência para encerrar |
| --- | --- | --- |
| 1 | Oráculo: qualidade e aceite | Ampliar acervo fictício e perguntas, avaliar recuperação e respostas com modelo real, registrar revisão humana explícita e aceite autenticado de produção sem dados de teste. Medir latência, tokens e custo em produção. Os testes locais com IA simulada já passaram; não substituem estas evidências. |
| 2 | Comunidade e privacidade | Consolidar visibilidade, bloqueio e moderação entre feed, perfis, clubes e discussões; validar leitura e mutações entre duas contas. Investigar e repetir o cenário do feed que terminou com falha de exibição na rodada autenticada de 05/11, antes de declarar a suíte completa aprovada. |
| 3 | Jobs e notificações | Confirmar execuções reais dos crons e recuperação em produção; validar vazão do backlog e idempotência de lembretes. Claim/lease e retentativas já existem, conforme [Concorrência](CONCURRENCY.md). |
| 4 | Busca e cadastro de livros | Conferir relevância e latência com Google Books real; buscar, abrir prévia e salvar livro de dois autores em ambiente descartável, verificando autores e ISBN. O ranking já está implementado. |
| 5 | Integrações e experiência | Validar uploads, push em dispositivo e voz; conferir teclado e áreas seguras em aparelho real. Os testes de viewport e WebKit são evidência parcial, conforme [Mobile](ORACLE-MOBILE-VALIDATION.md). Câmera/scanner ficam fora deste aceite. |

As pendências acima são critérios ainda sem conclusão documentada nas fontes
revisadas, não afirmações de que todos esses recursos estejam quebrados.
O inventário operacional de privacidade também precisa acompanhar os provedores
ativos; seu registro antigo não deve ser usado como prova da configuração atual.

## Regras de validação

Gravações de teste ficam em ambiente isolado. Não inserir dados fictícios nem
alterar registros reais em produção para completar o roadmap. O aceite humano,
o acesso autenticado de produção e verificações em aparelho dependem de sua
respectiva evidência; não devem ser marcados como concluídos por CI verde.

Esta revisão atualiza prioridades e critérios, sem executar novamente os testes
históricos, validar provedores ou alterar configuração de produção.
