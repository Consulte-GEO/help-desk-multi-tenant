# Acesso à wiki no Help Desk — 14/10/2026

O usuário autorizou integrar a wiki publicada no site existente em `https://helpdesk.consultegeo.org/wiki/`, com atalho na central e preservação do conteúdo, busca, backend e login.

O Netlify encaminha exclusivamente `/wiki` e `/wiki/*` para o mesmo caminho no site `wiki-consultegeo.netlify.app`, da mesma equipe. O navegador mantém o domínio do Help Desk. A origem da wiki fornece seus próprios headers; o CSP restrito do Help Desk permanece intacto para a central e sua API. Os arquivos da wiki ficam realmente sob `/wiki/`, evitando reescritas de assets e conflitos com os arquivos da central.

Há atalhos na tela de acesso e no menu autenticado. A wiki mantém seu login e seu critério de acesso; o atalho não concede permissões ou transporta tokens. A edição interna continua lendo o backend `wiki_cg` depois da autenticação. O cache offline da wiki limita-se ao diretório `/wiki/` e não controla a raiz do Help Desk.

Nenhuma migration, usuário, segredo, escopo, módulo operacional ou gate do atendimento é alterado. API/interface0.30 e produção sobre schema0.19 permanecem como no checkpoint147.

Verificação local Windows: typecheck, contratos e build aprovados. A suíte de aplicação executou4710 casos:4665 passaram e45 falharam nos fixtures dependentes de symlinks, sockets Unix, TLS/OpenSSL, Python e caminhos locais. O log integral foi preservado no diretório isolado da tarefa. A evidência definitiva para publicação deve vir da homologação Linux desta fonte, com os seis logs e o fingerprint validados por `check:homologation`; `verify:release` permanece obrigatório.

Os testes da wiki incluem entrada `/wiki` com query/hash preservados, abertura/recarga de artigo, busca e home dentro do escopo do service worker. A revisão independente verificou os dois diffs e os assets, e a normalização da home identificada nela foi corrigida. A confirmação da publicação e do acesso hospedado é registrada após os checks remotos.
