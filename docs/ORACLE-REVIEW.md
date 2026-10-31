# Revisão técnica do roadmap do Oráculo

Revisão pelo agente em 30/10/2026, na branch `feat/oracle-quality-roadmap`,
comparando as alterações com `origin/main`. Não é revisão humana independente.
Nenhuma publicação, nova migração ou consulta a dados reais de leitores foi
executada nesta revisão.

## Achados confirmados e corrigidos

### P2 — nova tentativa indisponível após a segunda falha

Depois de receber a confirmação de sessão, a primeira falha de geração oferecia
uma nova tentativa. Se essa tentativa falhasse, o caminho de regeneração
restaurava a conversa, mas não restaurava o estado do botão de tentar novamente.
O leitor ficava sem essa ação de recuperação.

O teste novo em `e2e/oracle.spec.ts` reproduziu a falha no desktop antes da
correção, precisamente na ausência do botão após a segunda resposta com erro.
A correção distingue a tentativa de recuperação da regeneração explícita e
mantém a pergunta e a ação disponíveis. O teste executa uma terceira chamada
bem-sucedida, verifica uma única pergunta na tela e exige a sessão aceita e
`regenerate=true` nas duas tentativas, sem reenviar uma pergunta nova.

Correção: `b77d695`, em `app/oracle/page.tsx` e no teste de navegador.
Depois da correção, o cenário passou no desktop e no celular dentro da suíte
completa do Oráculo.

### P2 — embedding inválido podia impedir o fallback da busca

`generateEmbedding` aceitava qualquer array devolvido pelo provedor. Um vetor
com dimensão diferente da coluna `vector(1536)`, elementos não numéricos ou norma
zero podia chegar ao SQL e falhar, em vez de permitir o caminho por metadados.
O tratamento de erro também registrava o objeto da exceção do parser, que poderia
incluir conteúdo retornado pelo provedor.

O helper agora aceita somente 1.536 números finitos com ao menos um valor não
zero. Respostas inválidas retornam `null`, mantendo o fallback já existente da
busca. O uso informado pelo provedor continua registrado, mesmo se o vetor for
inutilizável. Erros de transporte ou JSON recebem somente uma mensagem estática
no log; o corpo e a exceção não são impressos.

Correção: `967f304`, em `lib/embeddings.ts`. Os testes cobrem dimensões menores e
maiores, strings, nulos, vetor zero, JSON inválido, propagação de cancelamento,
vetor válido e uso informado. A rota continua tendo seu teste de busca sem
embedding, e a integração anterior verifica a seleção por dono das fontes.

## Validações desta revisão

| Validação | Resultado |
| --- | --- |
| Suíte unitária final com cobertura | 403 testes aprovados em 59 arquivos |
| Integração completa com cobertura | 92 testes aprovados em 13 arquivos |
| Navegador do Oráculo | 14 testes aprovados, desktop e celular |
| Lint completo | Nenhum erro; 17 avisos preexistentes fora dos arquivos corrigidos |
| Lint dos quatro arquivos corrigidos | Aprovado sem avisos |
| Política e ferramentas de cobertura | Quatro testes aprovados |
| Ferramentas e isolamento de navegador | Quatro testes aprovados |
| Proteção do destino do banco de testes | Um teste aprovado |
| Verificação de segredos | Histórico completo aprovado |
| Política de cobertura combinada | Aprovada sem reduzir a base versionada |
| Build `npx next build --webpack` | Aprovado, incluindo TypeScript, 51 páginas e coleta de arquivos |

As suítes usaram PostgreSQL/pgvector em banco descartável e Redis exclusivo.
Os dois serviços foram encerrados após os testes. Os testes de navegador usam
respostas controladas de API e chaves de desenvolvimento de autenticação;
não são testes autenticados de produção nem avaliações do modelo real.

O scanner de segredos estava ausente do ambiente. Foi obtida a versão oficial
exigida pelo projeto, com SHA-256 conferido antes da execução, sem instalação
global. Os arquivos da ferramenta ficam nos relatórios locais ignorados pelo Git.

Cobertura combinada desta execução: linhas 35,98%, statements 34,87%, funções
33,24% e branches 31,09%. Linhas por área: módulos 85,35%, bibliotecas 50,53%,
componentes 40,23% e aplicação 19,78%. Atender à base não significa cobertura
completa da aplicação, e estes percentuais não demonstram qualidade das respostas.

## Escopo revisado e pendências

Foram inspecionados preparação de sessões, propriedade dos dados de contexto,
seleção de evidências, parser de conclusão, cancelamento e prazo do pipeline,
gravação atômica de respostas, controle de versão da memória, interface de memória
e recuperação de falhas no chat. Os achados confirmados acima foram corrigidos.

A avaliação real mais recente continua sendo a rodada sintética de dez cenários
e as três repetições externas registradas em
[ORACLE-EVALUATION.md](./ORACLE-EVALUATION.md). Não foi repetida, pois esta revisão
alterou recuperação de falhas e validação de vetores, sem mudar o prompt.

Continuam pendentes:

- Avaliação em acervo representativo e revisão humana independente.
- Montagem textual do contexto e orquestração da geração em módulos próprios,
  além da extração/revisão dos endpoints de sessões e artefatos.
- Publicação por PR, checks e merge e conferência do deployment correspondente.
- Validação autenticada e métricas de latência/custos em produção.

Microfone, TTS e o fluxo separado de voz não receberam revisão funcional completa
neste corte. O build e o navegador também sinalizam deprecações preexistentes de
middleware/autenticação, cuja migração não foi incluída nestas correções.
Esta revisão técnica não encerra o roadmap nem comprova publicação em produção.

A modularização pendente acima foi concluída posteriormente para o fluxo
fundamentado e os recursos de sessões e artefatos. O estado e a validação mais
recentes estão em [ORACLE-MODULES.md](./ORACLE-MODULES.md). Os resultados desta
revisão permanecem como registro do corte anterior.
