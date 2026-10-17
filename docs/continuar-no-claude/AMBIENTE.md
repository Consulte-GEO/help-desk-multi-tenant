# Ambiente para continuar com Claude Code

Use um clone novo do repositório real e branch própria. O fluxo integral de referência é Linux, PostgreSQL17 descartável, OpenSSL, Node compatível, Python e Chromium. Confirme as versões fixadas nos workflows da revisão recebida; não atualize dependências como parte do setup.

Node deve satisfazer `>=22.16.0 <25`; os workflows têm versões próprias, incluindo22.16.0. `npm ci --ignore-scripts` preserva os locks. O build instala o módulo importado a partir de seu lock, sem autorizar troca de versão.

```sh
git clone https://github.com/Consulte-GEO/help-desk-multi-tenant.git
cd help-desk-multi-tenant
git remote -v
git branch --show-current
git rev-parse HEAD
npm ci --ignore-scripts
npm run check:lock
npm run verify
npm run homologate:local
npm run check:homologation
```

Conferir a branch padrão no GitHub antes de escolher a base; o exemplo não presume `main`. A criação da branch deve seguir o nome do recorte e a política do responsável. No computador de origem, `origin` apontava a bundle histórico e `github` ao GitHub; um clone novo terá sua própria configuração.

O runner de homologação prepara bancadas locais e evidências. Os workflows HDA e Implantação executam qualificações específicas adicionais. Não rodar scripts SQL contra URL de produção, não inserir credenciais operacionais no ambiente e não converter fixture em fallback. Esta bancada não cria um segundo ambiente hospedado do Help Desk.

Registrar uma reprodução realmente observada antes de afirmar CL006 concluída: SO, ferramentas, SHA, lock, comandos, resultados e limites. Falha em Windows ou bloqueio de socket/rede não prova erro do produto. Quando a máquina não atender aos requisitos, usar o CI ou ambiente Linux autorizado e registrar a execução, sem remover testes para aprovar.

Após alteração: seguir AGENTS e os gates pertinentes ao recorte, com fonte exata. Uma contagem histórica aprovada não substitui a execução no novo código.
