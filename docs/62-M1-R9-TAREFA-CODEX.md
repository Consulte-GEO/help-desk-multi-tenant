# Tarefa executável — integrar R2–R9 e executar os gates reais

## Objetivo
Integrar sem perder o trabalho concorrente, revisar a correção de coerência dos logs e executar a toolchain real. Não desenvolver M2 nem ativar atendimento.

## Base
Remoto observado: `codex/m1-reproducibilidade`, commit `b9481b9fabde2fd9c442e44099bc17608b59571a`. R8 anterior: `ebb598af29a187c20d71d7395edabe3b722eebd0`. Conferir HEAD atual, PROJECT_HELP_DESK.md, README/AGENTS, docs59–61 e handoff remoto. O bundle é recuperação local, não upstream.

## Aplicação controlada
```bash
set -e
PACKAGE=/caminho/HelpDesk_M1_R9
CHECKOUT=/caminho/help-desk-multi-tenant
# Somente uma variante. r9-only exige R8 exato.
VARIANT=helpdesk-m1-r2-r9
node "$PACKAGE/source/scripts/check-integration.mjs" \
  --checkout "$CHECKOUT" --package "$PACKAGE" --variant "$VARIANT" --stage before
git -C "$CHECKOUT" apply --check "$PACKAGE/patches/$VARIANT.patch"
git -C "$CHECKOUT" apply "$PACKAGE/patches/$VARIANT.patch"
node "$PACKAGE/source/scripts/check-integration.mjs" \
  --checkout "$CHECKOUT" --package "$PACKAGE" --variant "$VARIANT" --stage after
```
Em divergência, não recalcular hashes para aceitar alterações; preservar e reconciliar. Não usar source como sobrescrita do checkout. Não aplicar ambas as variantes.

## Validar
```bash
set -e
cd "$CHECKOUT"
npm ci --ignore-scripts
npm run typecheck
npm run check:migrations
npm run homologate:local
npm run check:homologation
```
As etapas só são aprovadas com execução efetiva e saída correta. Esperado: 1.200 aplicação,209PostgreSQL,71HTTP/browser sem skips, instalação e auditoria aprovadas. Não completar relatórios manualmente. O runner de banco deve apontar para PostgreSQL17 novo/local descartável; jamais para Supabase remoto. Binários nativos exigem origem autorizada e usuário não root, conforme o runner existente.

## Revisão desta correção
Em `scripts/homologation-core.mjs`, conferir `coherentArtifacts` nas duas fronteiras: `validateReport` e `verifyLogs`. Todos os caminhos devem ser `runs/<mesma-execução>/<etapa>.log`; uma entrada por etapa. O caminho real do arquivo não pode diferir do caminho esperado sob a raiz resolvida. Nenhuma mudança do schema1 ou relaxamento de assinatura/fingerprint/contagens deve ser introduzida. Os oito testes de `tests/m1-evidence-coherence.test.ts` usam entradas sintéticas e não são provas SQL/browser.

## Saída
Entregar código/commit/base, relatório com comandos e exit codes, logs sanitizados e hashes, contagens realmente executadas, revisão independente quando disponível e distinção implementado/local/SQL/browser/deployado/homologado/operacional. Especificar se o mesmo código foi executado no CI e no host.

Function/Auth/M2M, carga, restore e aceite operacional continuam necessários. Esta tarefa não autoriza push/CI remoto/deploy, migrations, secrets, usuários, alterações de dados ou ativar a flag de liberação. Obter autorização atual específica para essas operações. Não pedir senha do usuário no chat.
