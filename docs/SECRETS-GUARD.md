# Proteção contra envio de segredos

Instale **Gitleaks 8.30.1** pelo projeto oficial e confira o checksum do pacote.
O workflow usa versão e SHA-256 fixos. Localmente, deixe `gitleaks` no PATH ou
configure `GITLEAKS_BIN` com o caminho absoluto do executável.

Depois de clonar e instalar o Node, execute `npm run secrets:hooks`. Isso configura
`core.hooksPath` localmente; não modifica a configuração global. A configuração
local pode ser compartilhada por worktrees do mesmo repositório. Se já houver
outros hooks, o instalador recusa sobrescrevê-los; integre as verificações ao fluxo
existente. Os arquivos dos hooks precisam estar presentes na branch em uso.

O pre-commit verifica o index e o pre-push verifica o histórico Git completo.
Também é possível executar `npm run secrets:staged`, `npm run secrets:scan` e
`npm run test:secrets`. Falha do scanner bloqueia a operação. A ausência de Node
ou Gitleaks deve ser corrigida; não remova a verificação para conseguir enviar.
Arquivos `.env` e suas variantes privadas são recusados mesmo sem token detectável;
somente `.env.example` pode ser versionado. `.gitignore` não protege um arquivo
que já esteja no index ou no histórico.

A CI roda em PRs, na principal e manualmente. Não exige chaves nem publica snippets,
valores, autores ou relatório contendo os segredos. Os testes usam somente valores
sintéticos e confirmam detecção e ocultação. As regras estendem o catálogo padrão
do Gitleaks com chaves privadas Clerk e senhas em URLs de banco. Exceções restritas
identificam a chave pública fictícia do build e os exemplos locais já documentados;
não há exclusão geral para testes, documentação ou arquivos de ambiente.

Hooks locais podem ser contornados e a CI já recebe o commit no servidor. Para
barrar também no GitHub, habilite Secret scanning e Push protection nas configurações
de segurança, onde disponíveis, e exija o check `secrets` na proteção de branch
após sua primeira execução aprovada. A cobertura de padrões do provedor não é
universal; nenhum detector garante identificar todo formato de variável sensível.

Nesta implantação, a API confirmou Secret scanning e Push protection **ativos**.
O scanner local também percorreu o histórico completo sem achados não excepcionados;
o catálogo padrão identificou como candidato somente a chave pública fictícia do
build, tratada por igualdade exata. Os exemplos de banco são conhecidos e públicos.

Se aparecer um segredo real, **revogue ou rotacione primeiro**. Remova-o dos commits
antes de enviar; se já foi publicado, excluir a linha em um commit novo não remove
o histórico. Planeje a limpeza com os colaboradores, sem reescrever ou forçar o
histórico automaticamente. Não adicione uma exceção para esconder o achado.

Referência: [documentação oficial do Gitleaks](https://github.com/gitleaks/gitleaks).
