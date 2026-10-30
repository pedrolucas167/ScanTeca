# Redução de consultas e diagnóstico de picos

## Medição antes/depois

Foi executado o código de consultas da revisão `5a5e155` e o código alterado contra PostgreSQL descartável, com 68 livros fictícios. Os comandos foram contados pelos eventos reais de query do Prisma 7.10.1, sem registrar parâmetros ou dados de usuários.

| Operação | Antes | Depois |
| --- | --- | --- |
| Ler configurações existentes | 3 SELECT + COMMIT: 4 comandos | 1 SELECT |
| Carregar Catálogo existente | 6 comandos | 3 SELECT |
| Criar configurações na primeira visita | 4 comandos | SELECT + INSERT: 2 comandos |

A leitura anterior usava upsert com atualização vazia, que o Prisma executava em múltiplos comandos. A nova implementação procura a configuração existente e só cria quando ausente. Um conflito de unicidade durante primeiras visitas concorrentes recupera o registro vencedor sem sobrescrever preferências.

Os testes de integração verificam um SELECT na leitura existente, três SELECTs no Catálogo e primeiras leituras concorrentes criando uma única configuração. A redução de comandos não significa redução de 50% no tempo da página: conexão, trânsito entre regiões, autenticação, imagens e inicialização continuam contribuindo.

## Diagnósticos por etapa

`PERFORMANCE_DIAGNOSTICS=1` habilita eventos `performance-stage` com apenas etapa, duração numérica e resultado. O padrão é desligado. As etapas cobrem middleware de autenticação das páginas medidas, autenticação da página/layout, tema e leitura de livros/configurações.

Não são registrados IDs, cookies, SQL, parâmetros, conteúdo de livros, URLs de conexão ou mensagens de exceção. Os logs podem ser correlacionados pelos metadados de requisição da Vercel. Ao terminar uma medição, remova/desative a variável e publique novamente para desligar o diagnóstico no ambiente.

As durações de acesso ao banco incluem espera por conexão e trânsito; elas não equivalem ao tempo de execução puro dentro do PostgreSQL. A extensão de estatísticas de consultas não estava disponível em produção e não foi instalada como parte desta investigação.

Eventos LCP também incluem o tipo genérico do elemento e, quando disponível, o início/fim do recurso correspondente. URLs são usadas apenas para a busca local no navegador e nunca são transmitidas. A validação da API remove campos extras e mantém compatibilidade com clientes anteriores.

## Contexto observado em produção

- As funções da aplicação estavam em `iad1`, enquanto o banco Neon/AWS estava em `aws-sa-east-1`. Este pacote não altera regiões.
- O banco foi suspenso e reativado nos intervalos de acesso investigados. Duas retomadas duraram aproximadamente 435 e 524 ms; isso não explica sozinho o registro anterior de resposta de 5,61 s.
- Uma repetição após pausa apresentou TTFB de 479 ms e LCP de 3.008 ms. Portanto, receber o primeiro byte não significa que o conteúdo do Catálogo já terminou de carregar.
- Medições da rota sem acervo tiveram TTFB próximo de 250–294 ms; o Catálogo variou mais. As amostras são pequenas e a atribuição dos logs foi feita por rota/horário, sem identificador de sessão no payload.

Não foram desativadas a suspensão do Neon ou as verificações de segurança, nem criado um mecanismo de keep-alive. Nenhuma alteração de dependências ou schema foi necessária.

## Validação

- 281 testes unitários passaram.
- 16 testes com PostgreSQL descartável passaram, incluindo contagem real de consultas e primeiras visitas concorrentes.
- Três testes autenticados no navegador passaram com banco descartável e diagnósticos habilitados, incluindo edição e isolamento entre contas.
- Build de produção e TypeScript passaram; lint sem erros.
- A redução de consultas foi medida localmente. O efeito sobre os tempos de produção ainda depende de medição após o deploy.
