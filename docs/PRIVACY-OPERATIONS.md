# Privacidade da ScanTeca

Registro de revisão de 05/11/2026. O inventário descreve fluxos identificados no
código e no runbook. Confirme as decisões operacionais abaixo com Pedro Lucas
Marques antes de publicar o aviso. O endereço de atendimento é
`pedro_marques_dev@hotmail.com`.

## Inventário inicial

| Tratamento e finalidade | Dados e sistemas identificados | Pendente de confirmação |
| --- | --- | --- |
| Cadastro, autenticação e aceite | Cadastro e sessão no Clerk. ID da conta, versão e data do aceite no PostgreSQL. | Configuração de cadastro, base legal, retenção, região, subprocessadores e exclusão de contas. |
| Biblioteca e leitura | Acervo, diário, anotações e preferências no PostgreSQL. Buscas bibliográficas usam Google Books e Open Library. | Retenção após encerramento, backups e destinatários de buscas e capas. |
| Comunidade e imagens | Perfil, publicações, interações e moderação. Imagens enviadas ao S3 e entregues pelo CloudFront. Alguns conteúdos ficam disponíveis conforme a visibilidade do recurso. | Acesso a objetos, política de cache, remoção de cópias e retenção. |
| IA e Oráculo | Histórico, memória e artefatos no PostgreSQL. O OpenRouter é a única integração direta de IA identificada no código para conversa, voz, recomendações, embeddings e moderação. As entradas variam por recurso e podem incluir áudio e contexto. | Modelos e operadores de inferência efetivamente usados pelo OpenRouter, dados enviados por função, retenção, uso posterior e destinos. |
| Segurança, hospedagem e entrega | Vercel e instrumentação OTel, PostgreSQL no Neon, Redis para limites e cache, serviços de Web Push e fontes externas do Google. | Retenção de logs e backups, regiões, contratos, serviços habilitados e acessos operacionais. Revisar a retenção dos logs de Web Vitals anteriores à mudança. |

Referências técnicas no repositório: `prisma/schema.prisma`, `lib/s3.ts`,
`lib/redis.ts`, `instrumentation.ts`, `modules/oracle`,
`app/api/oracle` e
`docs/CI-DEPLOY-RUNBOOK.md`. Configurações declaradas e exemplos de ambiente
não comprovam as regiões, os serviços ativos nem as garantias contratuais.

A consulta de metadados do projeto vinculado no Neon indicou a região
`aws-sa-east-1` (São Paulo) e uma janela de restauração de 21.600 segundos
(6 horas). A janela de restauração não comprova a retenção de snapshots,
exportações ou cópias mantidas separadamente.

O responsável indicou [seu perfil público](https://github.com/pedrolucas167)
como referência e um limite de seis meses para logs e backups, com uso dos
padrões dos fornecedores quando compatíveis. Este limite é uma decisão
operacional, não uma obrigação geral do Marco Civil. Use a janela menor
sempre que atender à finalidade, sem estender padrões mais curtos.
Documente separadamente eventual preservação legal específica.

A consulta autenticada aos metadados da equipe Vercel confirmou o plano
Hobby. A Vercel documenta retenção de uma hora para os logs de execução
nativos desse plano. Exportações e destinos externos devem ser verificados
separadamente. Logs de build são uma categoria separada e não devem conter
dados pessoais de usuários.
[Documentação de logs da Vercel](https://vercel.com/docs/logs/runtime).

O OpenRouter informa que as práticas de retenção e uso das entradas variam
conforme o provedor do modelo. Confira as rotas permitidas e as configurações
da conta da ScanTeca antes de descrever retenção ou uso para treinamento no
aviso. O cliente em `lib/openrouter-chat.ts` não fixa um requisito de
retenção zero e permite fallback na rota de modelos gratuitos. O padrão do
serviço, por si só, não confirma os destinatários ou a retenção das rotas
ativas. Consulte a [política do OpenRouter](https://openrouter.ai/privacy).

### Rotas de IA identificadas em 06/11/2026

A listagem de nomes de variáveis na Vercel indicou a configuração do
OpenRouter. A tabela abaixo cruza os modelos padrão no código com o catálogo
público de endpoints. Ela identifica rotas possíveis na data da consulta,
sem comprovar o operador usado por uma solicitação real ou a política da conta.

| Recurso | Modelo padrão no código | Operadores listados no catálogo |
| --- | --- | --- |
| Conversa e moderação | `google/gemini-2.5-flash` | Google AI Studio |
| Recomendações | `meta-llama/llama-3.1-8b-instruct` | DeepInfra, Groq, Cloudflare e CoreWeave |
| Embeddings | `openai/text-embedding-3-small` | Azure e OpenAI |
| Transcrição | `openai/whisper-1` | OpenAI |
| Voz | `openai/gpt-audio-mini` | OpenAI |
| Síntese de voz | `hexgrad/kokoro-82m` e `mistralai/voxtral-mini-tts-2603` | DeepInfra, Together e Mistral |

Consulta somente leitura, sem enviar conteúdo ao OpenRouter. Antes de
publicar, confira as restrições de roteamento na conta e identifique o
instrumento aplicável à transferência de dados. A lista pública é dinâmica.

Para fechar o inventário, registre por finalidade a base legal, a retenção e
o critério de descarte. Para cada fornecedor ativo, registre seu papel, dados
enviados, país de processamento, subprocessadores relevantes, termos de
retenção e exclusão e evidência de contrato. Quando houver transferência
internacional, registre o mecanismo aplicável e as informações que devem
constar no aviso. Use referências ao painel ou contrato em local restrito,
sem copiar credenciais ou dados de titulares para o Git.

## Bases legais e limites de retenção

Esta é a proposta para revisão do responsável. A base legal é vinculada à
finalidade de cada operação. O aceite dos termos, por si só, não vale como
consentimento para todas as operações.

### Cadastro e enquadramento atual

Em 05/11/2026, a tela pública de cadastro exigia nome de usuário, e-mail e
senha na opção por e-mail e oferecia Google e GitHub como alternativas. A
conferência foi feita sem preencher o formulário. Os campos da opção por
e-mail não comprovam os dados recebidos de cada provedor social. Confirme os
escopos no Clerk antes de publicar a descrição desses fluxos.

O e-mail e a credencial atendem à autenticação por e-mail. O código identifica
a conta pelo ID do Clerk. O nome de usuário aparece como alternativa de
exibição em recursos sociais. Avalie torná-lo opcional ou pedi-lo quando a
pessoa configurar o perfil, após validar o efeito no login de contas existentes.
Notificações são uma escolha separada do cadastro. Esta entrega retira a
coleta de Web Vitals no navegador e adia a preferência de cidade. Os traces
operacionais e a retenção dos logs históricos exigem revisão própria.

Pedro Lucas Marques informou que opera a ScanTeca como pessoa física, sem
lucro, e descreve o projeto como de código aberto. A ScanTeca oferece uma
aplicação de internet. No cenário informado, a obrigação ordinária de guarda
de seis meses do art. 15, caput, não se aplica, pois o dispositivo exige
provedor constituído como pessoa jurídica nas condições ali previstas.
Documente e cumpra eventual ordem específica de preservação. Reavalie se a
forma de operação ou a finalidade mudar.

| Operação | Base legal aplicável ou a validar | Limite e descarte |
| --- | --- | --- |
| Conta, autenticação e recursos solicitados, incluindo biblioteca, publicações, notificações solicitadas e execução de uma consulta ao Oráculo | Execução do contrato ou procedimentos a pedido do titular, art. 7º, V, apenas para dados necessários à função solicitada. | Enquanto a conta ou o recurso exigir os dados. Ao excluir o conteúdo, retirar a preferência ou encerrar a conta, avaliar o término da finalidade e excluir o que não tiver fundamento específico para conservação. |
| Aceite dos termos | Art. 7º, V, para administrar o vínculo. Após o encerramento, avaliar conservação estritamente necessária para exercício regular de direitos, art. 7º, VI, quando aplicável. | Enquanto necessário ao vínculo. Se houver fundamento para conservação posterior, guardar apenas a evidência mínima pelo prazo aplicável ao caso e registrar a data de descarte. |
| Memória, personalização, moderação e segurança operacional | Validar separadamente necessidade e base legal. Legítimo interesse, art. 7º, IX e art. 10, só se sustenta quando o teste de balanceamento documentado justificar a operação. Se houver dados sensíveis, analisar o art. 11 antes de tratar. | Reter somente o necessário para cada finalidade comprovada. Confirmar exclusão de memória, expiração de caches, retenção de logs e ciclo de backups com os fornecedores. |
| Solicitações dos titulares e ordens de autoridade | Obrigação legal ou regulatória, art. 7º, II, quando aplicável. Exercício regular de direitos, art. 7º, VI, conforme o caso. | Guardar a evidência mínima necessária para concluir o atendimento ou cumprir a obrigação específica. O prazo de resposta do art. 19 não é prazo de guarda. |
| Registros de acesso à aplicação | No enquadramento informado acima, o art. 15, caput, não é base para guarda de rotina. Avaliar separadamente a base de logs operacionais e eventual determinação específica de preservação. | Guardar só os dados necessários à finalidade documentada ou os registros especificados em determinação aplicável, pelo período correspondente. A regra de seis meses, quando aplicável, refere-se a IP, data e hora de acesso à aplicação. |

Os arts. 15 e 16 da LGPD estabelecem o término do tratamento e a eliminação,
ressalvadas as hipóteses legais de conservação. Quando não houver um prazo
numérico aplicável, documente o evento que encerra a necessidade, o menor
período operacional de descarte e quem confere a execução. Uma exceção de
guarda deve identificar o fundamento, os dados mínimos, o acesso permitido
e quando será reavaliada ou encerrada. Essa política ainda exige validação
dos fluxos de exclusão e dos prazos dos fornecedores e backups.

## Atendimento de solicitações

1. Registre protocolo, data de recebimento, direito solicitado, responsável,
   prazo e estado em local restrito. Confirme o recebimento. Para confirmação
   de tratamento ou acesso, observe o art. 19: resposta simplificada imediata
   ou declaração completa em até 15 dias, conforme o pedido e as regras
   aplicáveis. O atendimento é gratuito.
2. Verifique a identidade por canal já associado à conta, com confirmação
   proporcional ao risco. Para representante, confira a autorização.
   Registre o resultado da verificação, sem guardar senhas, códigos de login
   ou documentos desnecessários.
3. Para acesso, use o download autenticado como ponto de partida. Se a
   solicitação incluir anexos ou dados complementares, localize a conta
   verificada pelo ID Clerk, consulte somente os registros pertinentes
   e confirme a titularidade dos objetos antes de entregá-los. Revise a cópia
   para proteger dados de outras pessoas. Informe origem, finalidade e
   demais detalhes aplicáveis ao pedido.
4. Para correção, aplique apenas as alterações confirmadas. Para eliminação,
   inventarie Clerk, PostgreSQL, objetos, caches, logs, backups e fornecedores
   relevantes. Avalie a hipótese legal e retenções aplicáveis. Registre o
   resultado por sistema e comunique os destinatários quando exigido.
   A exclusão de uma conta no Clerk não comprova a exclusão nos demais sistemas.
5. Entregue por canal autenticado ou protegido com prazo de acesso. Registre
   a entrega, as limitações e a justificativa de eventual atendimento parcial.
   Descarte cópias temporárias quando deixarem de ser necessárias. Informe o
   canal da ANPD se a solicitação não for solucionada.

Exercite o procedimento com uma conta fictícia: receba um pedido simulado,
verifique a identidade, gere o JSON, localize um anexo fictício, confira a
separação entre duas contas e simule correção e eliminação. Registre os passos
e as lacunas. O teste automatizado de download existente valida o isolamento
do endpoint, mas não cobre a operação manual nem a exclusão nos fornecedores.

Fontes oficiais: [LGPD, arts. 6º–9º, 18–19, 33, 37 e 46](https://www.gov.br/mme/pt-br/arquivos/legislacao-consolidada-lgpd.pdf),
[direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares),
[guia de cookies da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais)
e [Regulamento de Transferência Internacional](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024).

Referências sobre retenção e bases legais:
[Marco Civil da Internet, arts. 5º e 15](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm),
[Decreto nº 8.771/2016, art. 13](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/decreto/d8771.htm)
e [Guia de legítimo interesse da ANPD](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-orientativo-sobre-legitimo-interesse).
