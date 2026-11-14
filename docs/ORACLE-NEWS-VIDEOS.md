# Notícias e vídeos no Oráculo

O Oráculo reconhece pedidos explícitos de notícias e vídeos e consulta os
endpoints específicos do Brave. Exemplos:

- `Notícias recentes sobre literatura`
- `Traga notícias desta semana sobre o Prêmio Jabuti`
- `Notícias de hoje sobre livros`
- `Vídeos de entrevistas com Conceição Evaristo`
- `Mostre entrevistas em vídeo de "Octavia Butler"`
- `Me mostre resenhas em vídeo de livros`
- `Onde posso assistir a vídeos sobre literatura?`
- `Gostaria de ver resenhas de livros em vídeo`

O reconhecimento cobre famílias de pedidos diretos, perguntas e pedidos
indiretos, com singular/plural e o formato antes ou depois do tema. Pedidos sem
tema recebem esclarecimento sem chamar o Brave nem o modelo. Negação e menção
a vídeos em uma conversa não são, por si só, autorização de busca. O
reconhecimento continua delimitado; não interpreta toda formulação possível.

Uma falha relatada no aceite manual mostrou que “Me mostre resenhas em vídeo de
livros” caía na conversa comum. O teste da rota reproduziu a ausência da busca;
a correção mantém esse caso e variações de intenção como regressões. As
instruções de conversa também descrevem a busca por links e seu limite de
reprodução, para evitar negar uma capacidade disponível.

“Recentes” e “deste mês” limitam a idade da página a 31 dias, “desta semana” a
sete dias e “de hoje” a 24 horas. Sem período explícito, não há esse filtro.
As datas do Brave podem corresponder à publicação ou atualização da página;
não comprovam a data do evento. Os resultados não são uma lista exaustiva.

São consultados até dez resultados e selecionadas até cinco fontes HTTPS,
com URLs únicas. Título, domínio, descrição e, quando fornecidos, data da página,
criador e duração entram nas fontes e no contexto numerado. O Oráculo apresenta
os resultados sem alegar leitura integral, reprodução ou transcrição dos vídeos.
Os links dos cartões de fontes abrem as páginas originais; não há player embutido.

Apenas os termos explícitos da busca são enviados ao Brave, sem acrescentar
acervo, perfil ou histórico. Pedidos ambíguos de contexto privado recebem uma
orientação para informar tema público. Autenticação, rate limit, cancelamento,
validação de citações e persistência de respostas seguem o fluxo existente.
Falha, cota indisponível ou resultado vazio não dispara outra busca nem geração.
É usada a chave Brave já configurada; não há novo secret.

## Validação

Em 14/11/2026, os 80 testes direcionados de parsing, filtragem, cancelamento e
rota passaram. Duas consultas reais com termos públicos retornaram cinco
resultados cada: notícias de literatura e vídeos de entrevistas com Conceição
Evaristo. Títulos, URLs e datas estavam presentes; vídeos também tinham duração.
Nenhum conteúdo privado foi enviado e nenhuma credencial foi registrada.

Essas consultas confirmam o contrato dos endpoints, não o aceite autenticado
da aplicação em produção. CI, merge e deployment devem ser conferidos
separadamente; este registro não declara publicação por si só.

Referências: [News Search](https://api-dashboard.search.brave.com/api-reference/news/news_search/get)
e [Video Search](https://api-dashboard.search.brave.com/api-reference/videos/video_search/get).
