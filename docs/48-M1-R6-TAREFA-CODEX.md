# Codex — integrar M1-R6 e executar validação real

## Escopo e fonte
Ler PROJECT_HELP_DESK.md, README/AGENTS e estado/handoff atuais do checkout. Ler docs44–48 do pacote. Base remota observada b9481b9fabde2fd9c442e44099bc17608b59571a; R2–R6 foram entregues localmente e não publicados. Reinspecionar HEAD/branch e mudanças concorrentes. A fonte/bundle recuperados não representam a história integral upstream.

```bash
git status --short
git branch --show-current
git rev-parse HEAD
```

## Escolher somente uma variante
`helpdesk-m1-r2-r6` para base remota sem R2–R5. `helpdesk-m1-r6-only` para R5 exato. Não aplicar ambas; R6-only não serve para R2/R3/R4. Preserve conteúdo staged/untracked e documentos remotos. Os exemplos abaixo usam caminhos POSIX; no PowerShell use caminhos locais absolutos e mantenha cada comando numa linha, sem barras de continuação.

```bash
node /caminho/PACOTE/source/scripts/check-integration.mjs --checkout /caminho/REPOSITORIO --package /caminho/PACOTE --variant helpdesk-m1-r2-r6 --stage before
cd /caminho/REPOSITORIO
git apply --check /caminho/PACOTE/patches/helpdesk-m1-r2-r6.patch
git apply /caminho/PACOTE/patches/helpdesk-m1-r2-r6.patch
node /caminho/PACOTE/source/scripts/check-integration.mjs --checkout /caminho/REPOSITORIO --package /caminho/PACOTE --variant helpdesk-m1-r2-r6 --stage after
```

Antes de aplicar, exigir exit0 e ok:true na inspeção. Depois exigir after aprovado. Hash divergente é conflito a investigar, não um valor a atualizar artificialmente. Sem `--unsafe-paths`, limpeza do checkout ou force-push. A inspeção não é assinatura de autenticidade nem aprovação de código/testes.

## Execução prioritária
Usar Node compatível com engines, registry autorizado e lock real. OpenSSL é requerido pelos6 testes TLS locais. Executar os comandos com logs completos:

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

Na fonte entregue são1177 Node (inclui6TLS),209SQL (193principais+16upgrade),71HTTP/browser (35HTTP+36browser). Não converter skips ou testes escritos em aprovações. A suíte PostgreSQL exige banco novo/descartável e login restrito; nunca Supabase remoto como fallback. Native é opção explícita do runner já existente, com PostgreSQL17 instalado e usuário não root, não improviso para contornar bloqueio. Não aumentar timeouts para forçar sucesso. Não reutilizar evidências antigas nem tipos globais como substituto de npm ci.

## Revisão e ambiente hospedado
Rever especialmente resultado confirmado/unknown/recusado quando release lança, logs sem erro bruto, não repetir mutação, marcação lógica versus descarte físico, e persistência única de ticket/evento/outbox nas duas fixtures novas. Solicitar revisão independente. A escrita de teste em PostgreSQL descartável não autoriza escrever em produção.

Após os gates locais, com autorização atual específica e segredos no canal apropriado: pg/TLS, diagnóstico/runtime dentro da Function, login humano, refresh/revogação, M2M e isolamentoA/B. Não usar a flag de liberação global como ferramenta de teste. Completar carga/abuso, restauração e governança antes do aceite M1; não iniciar M2 prematuramente.

## Fechamento
Atualizar os docs04/05 e backlog NO CHECKOUT REAL preservando históricos. Informar base, branch, commit, migrations, dependências, SQL/browser efetivamente executados, deploy/homologação/operação separados e os bloqueios restantes. Só realizar push/PR/deploy/migration remota com autorização atual explícita; as instruções anteriores de outros chats não autorizam essas ações nesta rodada.
