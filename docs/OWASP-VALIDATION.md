# OWASP Dependency-Check: validação

Correção da PR existente de OWASP em 05/11/2026. O workflow original já chamava
o scanner, mas apenas manualmente ou por agenda. Os checks verdes da PR não
demonstravam uma execução do novo job.

## Configuração corrigida

- O workflow também executa em PRs que alterem o scanner, suppressions ou manifests.
- Dependency-Check 13.0.0 e a action de cache têm referências imutáveis verificadas.
- A base de vulnerabilidades fica em cache separado dos relatórios. A carga
  inicial tem prazo maior; concorrência cancela somente execução antiga do PR.
- Usa o [feed público NVD 2.0](https://nvd.nist.gov/vuln/data-feeds) e o analisador
  npm audit, sem secrets. O feed é uma alternativa suportada pelo
  [mantenedor do Dependency-Check](https://github.com/dependency-check/DependencyCheck/discussions/8633).
- Sonatype OSS Index, que exige credencial própria, está explicitamente fora
  desta configuração. Isso é uma limitação de cobertura, não uma aprovação dele.
- O contêiner recebe apenas package.json, package-lock.json e suppressions em
  uma área temporária com node_modules instalado pelo lockfile, sem scripts de
  dependências (`npm ci --ignore-scripts`). A análise parte do lockfile, e a
  área é montada somente em leitura. Saída e cache usam mounts separados.
  Não monta .env, .git, banco ou o workspace completo.
- Só registra sucesso depois de verificar HTML, JSON e SARIF não vazios, engine
  esperada, componentes analisados e estrutura SARIF. Relatório parcial não aprova
  uma falha do scanner. Erros operacionais reprovam o job.
- Vulnerabilidades permanecem informativas, como na proposta original: severidade
  e quantidade ficam no resumo e no artifact. Isso não significa ausência de CVEs.
- Nenhuma supressão ativa foi adicionada; o exemplo Java sem relação com este
  projeto foi removido.

## Evidências

Seis testes locais passaram: instalação isolada sem scripts, isolamento dos mounts
e digest, identidade numérica
do usuário do runner, limite dos nomes
de containers próprios, deduplicação/severidades e rejeição de relatórios vazios
ou inválidos. A tentativa original em cópia isolada iniciou a atualização de
419.455 registros NVD sem API key; isso não comprovou geração do relatório.

A correção ainda exige uma execução real do novo job e conferência do artifact
no GitHub antes de ser considerada aprovada. Nenhum dado de produção participa.

A primeira execução real da correção falhou ao ler o input no Linux: a pasta
temporária pertence ao runner, enquanto a imagem usa outro usuário. O contêiner
agora recebe o UID/GID do runner, preservando a pasta privada e o mount em
leitura. Falhas também geram um resumo de diagnóstico para o artifact, sem
transformar um resultado parcial em aprovação. A repetição ainda é necessária.

A segunda execução atualizou a base NVD e gerou os três formatos, mas foi
corretamente reprovada porque não havia componentes no relatório. O Node Package
Analyzer exige node_modules. A preparação agora instala o lockfile na área
isolada com scripts desabilitados e inclui dependências de desenvolvimento.
Somente uma execução do scanner com exit code zero permite salvar a base em
cache; isso não substitui a verificação de componentes e relatórios.

## Execução real aprovada e atualização final

A execução [42027368618](https://github.com/pedrolucas167/ScanTeca/actions/runs/42027368618)
terminou com sucesso. O artifact foi baixado e inspecionado: 676 componentes,
engine 13.0.0, HTML, JSON e SARIF 2.1.0 válidos. O log registra conclusão dos
analisadores Node Package, NVD CVE e Node Audit. Pacotes opcionais de outras
plataformas não instalados no runner Linux são ignorados, com aviso no log.
O relatório dessa execução não listou vulnerabilidades; isso não comprova
ausência de problemas, nem equivalência com todos os resultados de npm audit.

A branch recebeu a main com as atualizações de Actions e de dependências de
produção. Os seis testes locais passaram novamente. Uma nova execução real no
GitHub e a inspeção dos artifacts do commit atualizado são condições para merge.

A execução [42032758528](https://github.com/pedrolucas167/ScanTeca/actions/runs/42032758528)
também aprovou o scanner após atualizar com a main. A conferência complementar
com npm audit no mesmo lockfile mostrou oito pacotes afetados por um advisory
moderado, GHSA-g3hv-75wg-m249, na cadeia de desenvolvimento do ESLint/minimatch.
Não há achados altos ou críticos nessa consulta. Não foi determinada equivalência
entre a cobertura do Node Audit embutido e a do npm CLI; não se atribui causa
ao desvio sem evidência. O runner agora publica npm-audit.json e contagens
separadas de npm audit, incluindo desenvolvimento. Falha de consulta ou métricas
inválidas reprovam; achados seguem informativos. Nenhuma atualização automática
ou supressão foi aplicada para esconder esse aviso. Dois testes adicionais
cobrem achados moderados e rejeição de resultados inválidos.

## Limites de cobertura

NVD, npm e Docker Hub são serviços externos: indisponibilidade pode reprovar a
execução. O cache reduz downloads, sem transformar uma base ausente em aprovação.
A análise foca os manifests npm; não é pentest, análise de infraestrutura nem
prova de ausência de vulnerabilidade. O resultado não altera regras de merge.
