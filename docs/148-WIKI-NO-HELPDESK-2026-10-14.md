# Acesso à wiki no Help Desk — 14/10/2026

O usuário autorizou integrar a wiki publicada no site existente em `https://helpdesk.consultegeo.org/wiki/`, com atalho na central e preservação do conteúdo, busca, backend e login.

O Netlify encaminha exclusivamente `/wiki` e `/wiki/*` para o mesmo caminho no site `wiki-consultegeo.netlify.app`, da mesma equipe. O navegador mantém o domínio do Help Desk. A conferência HTTP em produção demonstrou que essa reescrita entre sites da mesma equipe aplica os headers da central à wiki. Os dois caminhos possuem agora regras próprias, posteriores à regra global, para preservar diagramas, imagens e vídeos da wiki. O CSP restrito do Help Desk permanece intacto para a central e sua API. Os arquivos da wiki ficam realmente sob `/wiki/`, evitando reescritas de assets e conflitos com os arquivos da central.

Há atalhos na tela de acesso e no menu autenticado. A wiki mantém seu login e seu critério de acesso; o atalho não concede permissões ou transporta tokens. A edição interna continua lendo o backend `wiki_cg` depois da autenticação. O cache offline da wiki limita-se ao diretório `/wiki/` e não controla a raiz do Help Desk.

Nenhuma migration, usuário, segredo, escopo, módulo operacional ou gate do atendimento é alterado. API/interface0.30 e produção sobre schema0.19 permanecem como no checkpoint147.

Verificação local Windows: typecheck, contratos e build aprovados. A suíte de aplicação executou4710 casos:4665 passaram e45 falharam nos fixtures dependentes de symlinks, sockets Unix, TLS/OpenSSL, Python e caminhos locais. O log integral foi preservado no diretório isolado da tarefa. A evidência definitiva para publicação deve vir da homologação Linux desta fonte, com os seis logs e o fingerprint validados por `check:homologation`; `verify:release` permanece obrigatório.

Os testes da wiki incluem entrada `/wiki` com query/hash preservados, abertura/recarga de artigo, busca e home dentro do escopo do service worker. A revisão independente verificou os dois diffs e os assets, e a normalização da home identificada nela foi corrigida. A confirmação da publicação e do acesso hospedado é registrada após os checks remotos.


## Homologação desta fonte

CI38590466202 aprovado, commit5d0a80c. lock:passed, install:passed, audit:passed, application:passed (4710/4710), postgres:passed (422/422), interface:passed (539/539). Fingerprint b0502e9d0f8f6c5a1c06249944dc00aa844b6912242e35e784f5c06cd4c1cea4. Artefato oficial11907612664, SHA256 4befe3cb791d3280f1823565792929a6765f6d7b01508070c1dd6ec5d0475229, conferido antes da extração. Os37 arquivos atuais foram importados sem apagar evidências anteriores. Wiki: CI38590975875 aprovado sobre4f2e5be, incluindo navegador desktop/mobile. O Chromium local não iniciou; o cenário completo foi confirmado no CI Linux.

## Ajuste dos headers após a publicação

A política da wiki permite estilos inline usados em diagramas, imagens `data:`/`blob:` e frames de `www.youtube-nocookie.com`, como no site original. A conexão Supabase continua limitada ao host existente. Scripts permanecem limitados à própria origem. A central conserva sua política global sem exceções adicionais. Como `netlify.toml` faz parte do fingerprint, este ajuste exige nova homologação Linux vinculada à fonte antes da publicação, seguida de smoke HTTP dos headers reais na CDN.


## Homologação da correção de headers

CI 38596250885 aprovado sobre be821a4e30d4cde8f637bfdbb72a041453a3278d. lock: passed, install: passed, audit: passed, application: passed (4710/4710), postgres: passed (422/422), interface: passed (539/539). Fingerprint 31ea1853c63adee80da697386168c22e32e00b9ce9e4f54fb8ce89a85cb0de88. Artefato oficial 11910946166, sha256:8f3db76af79b070df40f8e099649d6db8ae36c6be25b495b3fe923607d8c7b25, conferido antes da extração. Logs atuais importados sem apagar evidências históricas. Revisão focada sem achados; a publicação segue o mesmo Git/CD e verify:release. O smoke hospedado deve confirmar uma única CSP da wiki nos caminhos exato, home e artigo, além da política global intacta na central e em /wiki-other.
