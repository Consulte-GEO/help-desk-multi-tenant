# Tarefa Codex — integrar e validar Help Desk M1-R18

## Objetivo
Integrar os incrementos acumulados sem regressões e executar a suíte PostgreSQL com a nova conferência integral dos recibos. Não criar features M2 como substituto dos testes pendentes.

## 1. Ler e conferir a base
Leia PROJECT_HELP_DESK.md, README/AGENTS, docs97–100 e o handoff upstream R9. Execute:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
```
Consulte o HEAD atual no GitHub; não presuma que ainda seja `78bbb00112331531168ae24600604cb7f3148770`. Use branch de trabalho e preserve o histórico. Esta tarefa de integração local não autoriza operações externas sensíveis.

Confira os SHA-256 antes/depois no `manifest.json`. Para R9 sem R10–R17:
```bash
git apply --check /CAMINHO/DO/PACOTE/patches/helpdesk-m1-r10-r18.patch
git apply /CAMINHO/DO/PACOTE/patches/helpdesk-m1-r10-r18.patch
```
Sobre R17 EXATO, use `patches/helpdesk-m1-r18-only.patch`. Não aplique os dois. Não reaplique R2–R9 e não force a aplicação em base intermediária.

O manifesto é compatível com o verificador já existente. Antes de aplicar, em R9:
```bash
npm run --silent integration:check -- --checkout . --package /CAMINHO/DO/PACOTE --variant r9-r18 --stage before
```
Após aplicar, repita com `--stage after`. Sobre R17, selecione `--variant r17-r18`. `ok:true` aprova apenas a inspeção dos arquivos, nunca testes ou release.

## 2. Verificações
```bash
npm ci --ignore-scripts
npm run check:lock
npm run verify
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```
Exigir 1.417 testes Node, 215 PostgreSQL 17 (199 principais + 16 upgrade) e 71 checks HTTP/browser, sem skips, com a toolchain travada. Executar banco novo, local e descartável pelo runner existente. NÃO apontar essa suíte para o Supabase hospedado. A alternativa nativa exige escolha explícita, binários autorizados e usuário não-root conforme o runner.

## 3. Revisão dirigida
Arquivos funcionais: `supabase/tests/hosted-acceptance-scenarios.ts`, `tests/fixtures/postgres-acceptance-effects.ts`, `tests/fixtures/private-receipt-correlation.ts`, `tests/m1-private-receipts.test.ts`, `scripts/homologation-core.mjs`.

O helper deve conferir cada recibo após a primeira resposta confirmada, antes de incluí-lo na lista de mutações aceitas. Compare hash com pedido normalizado, campos privados com o recurso persistido daquele instante, timestamps com precisão de microssegundos e devolva cópia independente. No fechamento, compare a linha integral com a cópia. Não normalizar ou regravar o JSON do banco para fazê-lo passar.

Os 13 casos iniciais de corrupção devem reprovar; o controle íntegro deve passar. Os cinco tipos/atores de primeira gravação da fixture devem passar. Um microssegundo de diferença precisa reprovar, mas fusos equivalentes devem passar sem alteração do recibo. Nenhuma mensagem, nota, policy ou segredo deve ser impresso ao reprovar.

Execute os seis percursos SQL já registrados pelo `rls.test.ts`, inclusive reexecução completa e perdas de resposta após as cinco gravações. Não confundir esses testes com perda de COMMIT, Auth real, TLS hospedado ou despacho de outbox. Falhas do driver/SQL/fixture devem ser preservadas e corrigidas com regressão, nunca removendo constraints/asserts.

## 4. Encerramento
Produza logs vinculados ao commit/fingerprint desta execução, atualize estado/handoff/backlog e solicite revisão independente. Somente após autorização atual, trate publicação e aceitação hospedada separadamente. Não ligar HELPDESK_RELEASE_APPROVED para contornar pendências. M1 permanece aberto até Function/Auth/M2M, capacidade, restauração e aceite operacional comprovados.
