# Tarefa executável — integrar e validar Help Desk R19

## Instrução para colar no Codex ou Claude Code
Você está no repositório `Consulte-GEO/help-desk-multi-tenant`. Integre o pacote R19 preservando o HEAD e execute a homologação local completa. Não desenvolva uma nova funcionalidade, comparador, cliente ou runner antes de executar os testes existentes. Corrija somente defeitos reproduzidos nessa execução, com regressão. O R19 não traz alteração de código em relação ao R18; consolida o acumulado R10–R18 e as instruções de retomada.

Leia `PROJECT_HELP_DESK.md`, `AGENTS.md`, os documentos 101–104 e `manifest.json` do pacote. A base remota observada foi R9 `78bbb00112331531168ae24600604cb7f3148770`, mas confira o estado atual. Nenhuma autorização histórica permite alterações externas nesta tarefa. Trabalhe localmente em branch própria; não faça push, merge, PR, deploy, provisionamento ou alteração remota sem autorização atual.

## 1. Conferir checkout e escolher uma variante
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git remote -v
git fetch origin --prune
```
A leitura remota não autoriza publicar. Não limpar, descartar ou sobrescrever alterações locais. Se o checkout estiver limpo e corresponder a uma base admitida, crie uma branch de trabalho; não modifique a branch padrão em lugar.

| Base comprovada | Variante | Patch |
|---|---|---|
| R9, sem R10–R18 | `r9-r19` | `patches/helpdesk-m1-r10-r19.patch` |
| R18 exato | `r18-r19` | `patches/helpdesk-m1-r19-only.patch` |

Aplicar apenas uma. R10–R17 parciais ou HEAD diferente exigem comparação de arquivos e reconciliação; não usar `--reject`, `--unsafe-paths`, force-push ou copiar a fonte recuperada sobre o repositório real.

Exemplo PowerShell, ajustando apenas o caminho do pacote e selecionando a variante correta:
```powershell
$pkg = (Resolve-Path 'C:\CAMINHO\HelpDesk_M1_R19').Path
$variant = 'r9-r19'
$patch = Join-Path $pkg 'patches\helpdesk-m1-r10-r19.patch'

npm run --silent integration:check -- --checkout . --package "$pkg" --variant $variant --stage before
# Só prosseguir se exit code for 0 e ok=true.
git apply --check "$patch"
# Só prosseguir se o check aprovar.
git apply "$patch"
npm run --silent integration:check -- --checkout . --package "$pkg" --variant $variant --stage after
```
Para R18 exato, usar `r18-r19` e `helpdesk-m1-r19-only.patch`. O comando de inspeção já pertence ao código existente. `ok:true` confirma arquivos, não testes, PostgreSQL, deploy ou operação.

## 2. Preparar ambiente apto, sem alterar o produto
Use Node compatível com `package.json` e o lock do repositório. Disponibilize um registry autorizado e Docker local. Não reescreva o lock, não use `deps:resolve`, não desabilite verificação de TLS e não troque o driver para um mock.

Execute:
```bash
npm ci --ignore-scripts
npm run check:lock
npm run typecheck
npm audit --audit-level=high
npm run verify
npm run test:db:local
npm run test:ui:local
```
Se uma etapa falhar, registre saída e código de retorno. Só avance nas etapas independentes; não apresente as dependentes como aprovadas. Os testes SQL exigem PostgreSQL 17 novo, local e descartável. Nunca usar o Supabase publicado como destino da suíte destrutiva. O runner nativo é opção explícita já existente, com `HELPDESK_TEST_DB_ENGINE=native`, `HELPDESK_TEST_PG_BIN` e usuário não-root; não inventar fallback automático.

**Esperado:** 1.417 Node, 215 PostgreSQL (199 da suíte principal e 16 de upgrade), 35 HTTP + 36 browser. Zero skips, TODO e cancelamentos. Novos testes só aumentam a meta após uma correção necessária, não substituem casos existentes.

Para persistência, executar especialmente os seis percursos registrados em `supabase/tests/hosted-acceptance-scenarios.ts`. Eles cobrem escrita/replay/perdas de resposta e correlacionam oito conjuntos privados. Conferir os cinco recibos completos, snapshots, versões, eventos, outbox e `write_effects`. São dados sintéticos de um banco local real; o provedor de identidade permanece sintético. Não chamar isso de Supabase Auth ou Netlify homologados.

## 3. Gerar um conjunto único de evidências
Depois de resolver falhas reais, executar novamente o agrupador existente:
```bash
npm run homologate:local
npm run check:homologation
```
O agrupador repete instalação e testes para criar logs de uma mesma execução. Não juntar resultados de runs distintos ou editar metadados para satisfazer o gate. Guarde as falhas anteriores separadamente. Conferir fingerprint, commit, contagens e integridade dos logs. Tipos globais, metadados de banco e scanner heurístico não substituem seus gates correspondentes.

## 4. Revisão independente e destino hospedado
Solicitar revisão por outro executor, com diff, logs e decisões. Após autorização atual específica, publicar a branch/PR ou configurar homologação. A validação hospedada usa produção, com identidades e vínculos autorizados e os cenários descritos em docs101. Os metadados do projeto remoto não demonstram que esses dados já existam.

Usar a configuração privada de produção pelos mecanismos existentes, mantendo senhas/chaves fora do chat, Git e anexos. Executar os clientes existentes com as confirmações de destino e efeitos, diretamente em produção.

## 5. Saída obrigatória
Entregar diff/commit local, relatório por gate, logs de sucesso e falha, backlog atualizado e bloqueio restante exato. Diferenciar implementado, testado localmente, PostgreSQL real, navegador, deployado, homologado e operacional. Quando a barreira for acesso a registry/Docker/browser, declarar isso sem criar outra camada de código.

**Sem ambiente apto, este trabalho termina com diagnóstico e pacote preservado; não simular fechamento do M1.** M2 depende de Function/Auth/M2M reais, capacidade, restauração, governança e aceite operacional, além do CI.
