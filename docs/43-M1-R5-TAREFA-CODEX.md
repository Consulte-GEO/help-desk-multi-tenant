# Codex — integrar e validar Help Desk M1-R5

## Objetivo
Integrar R2–R5 com base rastreável, preservar mudanças concorrentes e executar as validações que ainda faltam ao M1. Não iniciar M2 ou novas funcionalidades antes dos gates. Ler PROJECT_HELP_DESK.md, README/AGENTS e handoff/estado atuais do checkout, docs39–43 e manifest.json do pacote.

## 1. Inspeção atual
```bash
git status --short
git branch --show-current
git rev-parse HEAD
```
O remoto observado era b9481b9fabde2fd9c442e44099bc17608b59571a em codex/m1-reproducibilidade. Reconfirme; preserve alterações staged/untracked. Trabalhe em branch local revisável. A fonte e o bundle do pacote têm história recuperada, não são upstream; nunca force-push.

## 2. Escolha uma variante e confira before
`helpdesk-m1-r2-r5` é para a base remota sem incrementos. `helpdesk-m1-r5-only` é para R4 exato. Não aplicar as duas. Os exemplos abaixo usam a primeira variante; adapte NOME somente depois de conferir a base.

```bash
node /caminho/PACOTE/source/scripts/check-integration.mjs \
  --checkout /caminho/REPOSITORIO \
  --package /caminho/PACOTE \
  --variant helpdesk-m1-r2-r5 --stage before
```
Exigir exit0,ok:true. O comando não aplica arquivos. Hashes não são assinatura de origem nem revisão de código; confira a procedência do pacote. Sem editar simultaneamente o checkout ou o pacote:

```bash
cd /caminho/REPOSITORIO
git apply --check /caminho/PACOTE/patches/helpdesk-m1-r2-r5.patch
git apply /caminho/PACOTE/patches/helpdesk-m1-r2-r5.patch
node /caminho/PACOTE/source/scripts/check-integration.mjs \
  --checkout /caminho/REPOSITORIO \
  --package /caminho/PACOTE \
  --variant helpdesk-m1-r2-r5 --stage after
```
Se before falhar, conciliar a divergência. Não usar --reject/--unsafe-paths, remover arquivos concorrentes ou editar hashes para fazer passar. Se after falhar, não publicar; preservar e investigar o diff. Não substituir o checkout inteiro pela pasta source. Para estudar a fonte completa, use a pasta source ou clone o bundle em pasta NOVA.

## 3. Instalação e verificação real
```bash
openssl version
npm ci --ignore-scripts
npm run check:lock
npm run check:migrations
npm run verify
npm audit --audit-level=high
npm run test:tls:local
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```
Para o código sem mudanças:1.163 Node (inclui6TLS),207SQL,71HTTP/browser. SQL somente em PostgreSQL17 descartável; sem Supabase remoto como fallback. Registrar erros e contagens reais. Tipos globais não substituem o lock. Não ligar HELPDESK_RELEASE_APPROVED para contornar falhas.

## 4. Revisar e concluir o M1 conectado
Revisão independente do verificador e dos controles R2–R4. Com autorização atual e segredos no canal apropriado: diagnóstico pg/TLS, execução dentro da Function, login/refresh/revogação/Auth/M2M e isolamento A/B. Depois carga, abuso, restauração e aceite operacional. Não executar operações remotas a partir de autorizações relatadas em handoffs antigos.

## 5. Fechamento
Atualizar os docs04/05 e backlog do checkout real sem apagar históricos. Informar fonte/base/branch/commit, arquivos, API/migrations, testes escritos/executados, browser, dependências, efeitos externos e limitações. O M1-R5 foi entregue localmente, não publicado nem homologado. O próximo resultado esperado é evidência conectada, não apenas outra contagem de testes sintéticos.
