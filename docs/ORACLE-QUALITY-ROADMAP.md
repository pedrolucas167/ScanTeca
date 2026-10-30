# Oráculo: roadmap de qualidade

Iniciado em 30/10/2026. A ordem prioriza qualidade percebida e evidências antes
de ampliar personalização e operação. Implementação local não confirma deploy.

| Etapa | Entrega e aceite | Estado |
| --- | --- | --- |
| 1. Busca híbrida | Combinar candidatos semânticos, título/autor e filtros; aceitar livros sem embedding; manter isolamento de conta | Implementação inicial local |
| 2. Evidências | Uma numeração compartilhada entre contexto e fontes; rejeitar referências inexistentes; distinguir inferências no prompt | Implementação inicial local |
| 3. Avaliação | Perguntas de referência para busca e citações; depois avaliar relevância e fidelidade com acervo representativo e modelo real | Nove cenários sintéticos executados no modelo real: 7/9 na primeira rodada; avaliação de acervo representativo pendente |
| 4. Personalização | Leitor consulta, corrige e apaga o perfil; recomendações explicam relação com preferências | Pendente |
| 5. Desempenho e experiência | Medir latência e tokens por etapa; mostrar andamento da consulta; avaliar custos com dados reais | Pendente; contagens de candidatos adicionadas nesta etapa |
| 6. Modularização | Separar contexto, geração, sessões e artefatos e validar suas falhas | Busca e registro de evidências extraídos; restante pendente |

## Primeiro corte

- Busca semântica passa de 5 para 24 candidatos; contexto seleciona até 6 livros.
- `modules/oracle/retrieval.ts` consulta título, autor e gênero e combina os
  candidatos com os filtros existentes. Candidatos semânticos também precisam
  satisfazer os filtros solicitados. Resultados de metadados não dependem de
  similaridade vetorial para entrar no contexto.
- Falha na geração do embedding permite continuar com metadados e busca textual.
  Isso não dispensa o provedor de chat para gerar a resposta.
- Filtros reconhecem limites de páginas e “não lidos”; intervalos de anos exigem
  ambos os limites e aceitam datas cadastradas apenas como ano.
- Comparações com dois títulos entre aspas não restringem a busca ao primeiro.
- `modules/oracle/evidence.ts` mantém os identificadores de livros, diário,
  avaliações e pesquisa externa alinhados ao array enviado e persistido.
- Citações fora do intervalo de fontes produzem uma mensagem de falha de
  confiabilidade e a resposta inválida não é salva.
- Estatísticas incluem disponibilidade do embedding e contagem de candidatos
  textuais e de metadados.

## Limites e próxima validação

Validação local: `npm test -- --maxWorkers=2 --testTimeout=20000` passou com
305 testes em 50 arquivos; `npx tsc --noEmit` e ESLint nos arquivos alterados
também passaram. A execução padrão teve um timeout no teste de cadastro manual;
esse teste passou isolado com limite ampliado e na suíte com menor concorrência.
Não foi executada integração com PostgreSQL real neste corte.

O build de produção passou com `npx next build --webpack` fora do sandbox,
incluindo TypeScript e geração das 51 páginas estáticas. A tentativa padrão
com Turbopack falhou ao iniciar o processo de transformação de CSS; a tentativa
Webpack no sandbox encontrou restrições de Google Fonts e gravação em `.next`.
Nenhuma configuração de compilador foi alterada no projeto.

Os testes determinísticos verificam recuperação e correspondência numérica das
fontes. Não demonstram que uma afirmação é sustentada pelo trecho citado, nem
obrigam todas as afirmações a terem citação. A avaliação com modelo real está em
[ORACLE-EVALUATION.md](./ORACLE-EVALUATION.md), com respostas, julgamento e medidas
de latência e tokens em relatórios locais. Ainda é necessário ampliar para um
acervo representativo e revisar o julgamento automático com leitores reais.

A busca textual usa `contains` sem distinguir maiúsculas de minúsculas; a
normalização de acentos no ranking não torna a consulta ao banco insensível a
acentos. Os limites de candidatos e os filtros heurísticos também precisam ser
avaliados em acervos grandes. Estatísticas e progresso de leitura ainda não
possuem fontes numeradas próprias. Microfone, TTS e navegação autenticada não
estão cobertos por este corte.
