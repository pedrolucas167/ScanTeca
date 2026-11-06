# Privacidade da ScanTeca

Registro de revisão de 05/11/2026. O inventário descreve fluxos identificados no
código e no runbook. Confirme as decisões operacionais abaixo com Pedro Lucas
Marques antes de publicar o aviso. O endereço de atendimento é
`pedro_marques_dev@hotmail.com`.

## Inventário inicial

| Tratamento e finalidade | Dados e sistemas identificados | Pendente de confirmação |
| --- | --- | --- |
| Cadastro, autenticação e aceite | Cadastro e sessão no Clerk. ID da conta, versão e data do aceite no PostgreSQL. | Configuração de cadastro, base legal, retenção, região, subprocessadores e exclusão de contas. |
| Biblioteca, leitura e cidade | Acervo, diário, anotações, preferências e cidade opcional no PostgreSQL. Buscas bibliográficas usam Google Books e Open Library. | Retenção após encerramento, backups e destinatários de buscas e capas. |
| Comunidade e imagens | Perfil, publicações, interações e moderação. Imagens enviadas ao S3 e entregues pelo CloudFront. Alguns conteúdos ficam disponíveis conforme a visibilidade do recurso. | Acesso a objetos, política de cache, remoção de cópias e retenção. |
| IA e Oráculo | Histórico, memória, artefatos e entradas enviadas ao OpenRouter, incluindo áudio nas funções de voz. O código também usa IA para recomendações, embeddings e moderação. | Modelos e provedores realmente ativos, dados enviados por função, retenção, uso posterior e destinos. |
| Segurança, hospedagem e entrega | Vercel e instrumentação OTel, PostgreSQL no Neon, Redis para limites e cache, serviços de Web Push e fontes externas do Google. | Retenção de logs e backups, regiões, contratos, serviços habilitados e acessos operacionais. Revisar a retenção dos logs de Web Vitals anteriores à mudança. |
| Métricas opcionais | Eventos de páginas permitidas após escolha positiva, contagens diárias no Redis por até 30 dias e preferência no navegador por até 180 dias. | Confirmar a configuração real de Redis e logs e registrar a evidência do fluxo de escolha e revogação por versão. |

Referências técnicas no repositório: `prisma/schema.prisma`, `lib/s3.ts`,
`lib/redis.ts`, `instrumentation.ts`, `modules/oracle`,
`app/api/oracle`, `app/api/vitals/route.ts` e
`docs/CI-DEPLOY-RUNBOOK.md`. Configurações declaradas e exemplos de ambiente
não comprovam as regiões, os serviços ativos nem as garantias contratuais.

A consulta de metadados do projeto vinculado no Neon indicou a região
`aws-sa-east-1` (São Paulo). Isso identifica a região do projeto consultado.
A retenção de backups e o tratamento por outros serviços seguem em revisão.

O OpenRouter informa que as práticas de retenção e uso das entradas variam
conforme o provedor do modelo. Confira as rotas permitidas e as configurações
da conta da ScanTeca antes de descrever retenção ou uso para treinamento no
aviso. Consulte a [política do OpenRouter](https://openrouter.ai/privacy).

Para fechar o inventário, registre por finalidade a base legal, a retenção e
o critério de descarte. Para cada fornecedor ativo, registre seu papel, dados
enviados, país de processamento, subprocessadores relevantes, termos de
retenção e exclusão e evidência de contrato. Quando houver transferência
internacional, registre o mecanismo aplicável e as informações que devem
constar no aviso. Use referências ao painel ou contrato em local restrito,
sem copiar credenciais ou dados de titulares para o Git.

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
