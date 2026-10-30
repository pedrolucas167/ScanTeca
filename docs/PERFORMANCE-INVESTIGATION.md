# Investigação de carregamento em produção

Data: 30/10/2026. Ambiente relatado: https://scanteca.vercel.app/.

## Resultado

O principal problema identificado no código estava em Descobrir: a página gerava recomendações durante a renderização sem utilizar o cache que já existia na API. Isso colocava IA e múltiplas buscas externas no caminho de carregamento do conteúdo.

Há outros fatores que podem afetar as telas autenticadas. A contribuição de cada um ainda precisa ser medida em uma sessão autenticada. Os achados abaixo descrevem o estado anterior às correções de Descobrir listadas ao final; as referências de linha correspondem a esse estado.

## Medições realizadas

Requisições GET sem cookies, executadas sequencialmente com curl, sem seguir redirecionamentos e com limite de 30 segundos:

| Página | HTTP | Primeiro byte | Download completo | Corpo recebido |
| --- | --- | --- | --- | --- |
| `/`, primeira amostra | 200 | 351 ms | 572 ms | 172.573 bytes |
| `/`, segunda amostra | 200 | 342 ms | 474 ms | 172.573 bytes |
| `/manifesto` | 200 | 269 ms | 507 ms | 151.098 bytes |
| `/descobrir`, sem autenticação | 200 | 838 ms | 981 ms | 135.536 bytes |

Essas amostras não medem execução de JavaScript, imagens, hidratação, LCP ou navegação com login. O HTTP 200 de Descobrir não confirma acesso ao conteúdo autenticado: redirecionamentos também podem ocorrer durante streaming. Não são percentis nem uma comparação de cache frio/quente da infraestrutura.

Uma consulta adicional à página inicial retornou `X-Clerk-Auth-Status: signed-out`, `X-Vercel-Cache: MISS` e `Cache-Control: private, no-cache, no-store`. O cabeçalho Link anunciou sete arquivos de fonte e sete imagens com preload. Isso indica concorrência potencial pelos recursos iniciais, mas não mede seu impacto no navegador.

O identificador Vercel continha `gru1::iad1`. É uma pista para conferir região de execução e proximidade do banco no painel de produção; não determina a região do banco. `vercel.json` não declara uma região.

O banco efetivo no ambiente de desenvolvimento aponta para um destino local e retornou `PrismaClientInitializationError`. Não foi possível medir consultas por ele. Nenhum dado foi alterado, e as integrações de IA não foram acionadas.

## Achados por prioridade

### 1. Descobrir ignora cache e espera integrações externas

- `app/descobrir/page.tsx:14` chama `buildRecommendations` diretamente em cada renderização no servidor.
- `app/api/recommendations/route.ts:26` já lê o cache Redis e publica o resultado com controle de versão, mas a página não passa por essa lógica.
- `lib/recommendations.ts:528` chama a IA sem timeout explícito.
- `lib/recommendations.ts:571` enriquece sugestões em sequência; `:612` faz até quatro buscas adicionais também em sequência. Com cinco sugestões válidas, são nove buscas lógicas, além de possíveis buscas de fallback e retries.
- `searchGoogleBooks` usa `fetchWithRetry` sem timeout por tentativa. Depois, embeddings dos candidatos também precisam terminar antes do retorno.

Prioridade: compartilhar o serviço de cache entre página e API, preservando a invalidação existente; limitar a duração das chamadas externas; executar buscas independentes com concorrência limitada. Separar a geração demorada do conteúdo básico permite apresentar a tela antes das recomendações.

### 2. Layout aguarda banco para um detalhe visual

`app/layout.tsx:95` aguarda autenticação e `:97` aguarda o tema de acento antes de retornar o HTML. A consulta tem cache por usuário de uma hora, portanto o custo de banco acontece em cache miss. O loading da página fica dentro desse layout e não cobre essa espera.

Prioridade: medir cache miss e duração da consulta. Considerar tirar essa dependência do caminho inicial, preservando a sincronização do tema e evitando flashes de cor. Layouts compartilhados são reutilizados na navegação: isso não significa uma consulta de tema em todo clique.

### 3. Catálogo e Jornada carregam conjuntos inteiros

`modules/library/queries.ts:9` carrega todos os livros e todos os campos escalares suportados pelo Prisma, sem paginação. O componente Catalog recebe esse conjunto para filtros, edição e exportação e renderiza todos os itens filtrados nas visualizações de lista e grade. `getLibrarySettings` também usa upsert em uma leitura; o custo exato depende do SQL gerado.

`modules/reading/journey.ts:15` busca todo o histórico de leitura, incluindo notas, para calcular métricas e selecionar cinco notas recentes em memória.

Prioridade: medir tamanho do payload e duração das consultas com acervos reais. Reduzir campos, separar detalhes de edição/exportação e limitar renderização ou paginação sem quebrar filtros e estatísticas. Na Jornada, separar agregações e notas recentes do histórico completo.

### 4. Feed e Perfil têm esperas em sequência

`app/api/profile/route.ts:16` aguarda `currentUser`, depois consulta o perfil e só então inicia as contagens de seguidores. `app/api/feed/route.ts:24` aguarda `currentUser`, rate limit, posts e verificações de visibilidade em etapas. As telas ainda iniciam essas APIs pelo cliente após hidratação.

Prioridade: medir cada etapa e paralelizar operações independentes, preservando autorização, rate limit e privacidade. Avaliar quando os dados adicionais de `currentUser` são realmente necessários.

### 5. Tráfego antecipado e revalidação de arquivos

`components/ui/RoutePrefetch.tsx:12` solicita quatro rotas na primeira ociosidade. O custo depende do prefetch parcial e dos limites de loading do Next; é um candidato a medição, não prova de quatro consultas completas.

`public/sw.js:71` inicia fetch mesmo com resposta presente no Cache Storage. Isso inclui arquivos versionados de `/_next/static/`, gerando requisições adicionais em visitas seguintes. A resposta em cache ainda é devolvida imediatamente, então esse trecho não bloqueia diretamente a tela; pode competir por rede.

Prioridade: usar cache-first para assets imutáveis e avaliar prefetch por intenção/rede. Medir as fontes globais e o CSS externo de Material Symbols antes de reduzir preloads.

## Validação necessária antes de concluir a causa geral

1. Capturar uma navegação autenticada nas telas afetadas, incluindo primeira visita e retorno, em desktop e celular.
2. Separar tempo de resposta do documento/RSC, carregamento das APIs, hidratação e imagens no waterfall.
3. Correlacionar traces do `@vercel/otel` já registrado com duração de Prisma, Clerk, Redis e integrações externas; os Web Vitals existentes são enviados a `/api/vitals` e registrados em log.
4. Conferir regiões de execução, Neon e Redis no ambiente publicado, além de eventuais cold starts e espera por conexões.
5. Após correções, comparar as mesmas navegações e condições; não usar o tempo da landing sem login como medida do catálogo autenticado.

## Correções aplicadas em Descobrir

- Página e API agora chamam `lib/recommendations-service.ts`, que reutiliza o cache Redis por usuário e preserva o protocolo de versão contra publicação após invalidação. O TTL existente é de uma hora.
- Cada leitura ou gravação do cache tem um limite de espera de 200 ms no serviço. Leitura que excede esse prazo gera sem cache e não publica sem versão; gravação lenta não prende indefinidamente a resposta. Esse limite libera a resposta, mas não cancela uma operação Redis já iniciada.
- A geração de IA utiliza timeout de oito segundos. Cada busca lógica no Google Books compartilha um sinal de timeout de seis segundos entre tentativas, leitura do corpo e fallback de idioma. O helper de retry para de repetir uma operação cancelada; um backoff já iniciado pode acrescentar uma pequena espera até a próxima checagem.
- Buscas do perfil começam junto com a geração de IA. Enriquecimento e buscas do perfil usam lotes de até três operações por grupo, preservando a ordem; os dois grupos podem se sobrepor, com até seis buscas lógicas simultâneas.
- A quantidade de sugestões de IA fica limitada às cinco solicitadas no prompt. Uma busca externa com erro retorna lista vazia, permitindo aproveitar resultados de outras buscas.
- `app/descobrir/loading.tsx` fornece feedback específico durante geração em cache miss.

Validação final sobre a main atualizada (Next.js 16.4.3, Prisma 7.10.1, Vitest 5.0.5): 252 testes unitários e cinco testes de integração com Redis real descartável passaram. O build de produção, incluindo TypeScript, passou. O lint terminou com zero erros e 17 avisos fora dos arquivos alterados. Os testes novos cobrem cache hit sem geração, publicação versionada, espera limitada por Redis, cancelamento sem retry, fallback de idioma com orçamento compartilhado e execução paralela limitada das buscas.

As alterações ainda não foram publicadas. Não foi medido um antes/depois autenticado em produção. Cache miss ainda aguarda a geração; banco, Redis e embeddings também contribuem para a duração total. Os timeouts descritos são das chamadas externas, não um prazo máximo para a página inteira.

## Comparativo mínimo reproduzível

Comando: `npx vitest run --config vitest.performance.config.ts`. O teste carrega a implementação anterior diretamente de `origin/main:lib/recommendations.ts`; antes da execução, atualize essa referência com `git fetch origin main`. Para repetir exatamente a comparação registrada, defina `SCANTECA_PERF_BASELINE=6f7813b1e37d2bf1e9ed3a39e64c7e835232461d`. Essa revisão tem o mesmo código de recomendações do ponto de partida desta alteração. O relatório de cada execução é salvo em `reports/recommendations-performance.json` (ignorado pelo Git).

Foram medidas cinco execuções por cenário, com o mesmo acervo, cinco sugestões, candidatos e embeddings simulados. As latências por operação foram fixadas em 80 ms para IA, 40 ms para Google Books, 20 ms para embeddings e 10 ms para Redis. O teste compara todo o resultado final, exceto o timestamp criado durante a execução, e verifica quantidade de chamadas e concorrência. Nenhuma integração real é chamada.

| Cenário | Mediana | Chamadas a provedores |
| --- | --- | --- |
| Implementação anterior | 538 ms | 15 |
| Nova, cache vazio | 246 ms | 15 |
| Nova, cache preenchido | 15 ms | 0 |
| Nova, Redis não configurado | 214 ms | 15 |
| Nova, leitura Redis travada | 429 ms | 15 |

A geração com cache vazio ficou cerca de 54% mais rápida nesse ensaio. O resultado e a quantidade de chamadas foram preservados. O teste também impede retorno de cache preenchido que ainda faça chamadas aos provedores.

Limites: isso valida a organização das esperas e o reaproveitamento de resultados, não substitui medição autenticada de produção ou teste de carga. Uma geração muito curta, como acervo vazio, pode ficar mais lenta pelo custo adicional da consulta ao cache; uma leitura lenta pode acrescentar até 200 ms e uma gravação lenta mais 200 ms. Portanto, não há garantia de melhoria para toda requisição. A proteção adicionada evita que essa nova dependência introduza espera ilimitada. A latência real depende também de regiões, quotas dos provedores, tamanho do acervo e disponibilidade do Redis.
