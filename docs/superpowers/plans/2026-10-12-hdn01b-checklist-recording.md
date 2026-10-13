# HDN-01b — plano e progresso da marcação autenticada

> Executar com `superpowers:executing-plans`; teste negativo antes de implementação, revisão independente antes de integração.

**Goal:** concluir marcação privada versionada ligada à futura jornada Cadastro de usuário.
**Architecture:** domínio puro + adapter PostgreSQL candidato + composição do resolver/runner existente + montagem HTTP opcional. Não criar outro motor de workflow.
**Tech Stack:** TypeScript/Node22, PostgreSQL17; sem dependência de produto nova.
**Spec:** `../specs/2026-10-12-hdn01b-checklist-recording.md` e plano V2.

## Restrições
Escopos existentes preservados; sem ações GEO, seed de publicação, usuário fictício hospedado, alteração de migrations antigas, abertura de gate ou nova API anunciada. Evidência limitada a nota interna do mesmo executor/chamado. Patch não substitui o checkout completo.

## Tarefas e evidência
- [x] T1 — decidir uma marcação e validar registro/evidência. 35 negativos inicialmente por interface ausente;35GREEN. `src/domain/execution-checklist-mark.ts`; `tests/execution-checklist-mark.test.ts`.
- [x] T2 — adapter na conexão emprestada e envelope fechado/erros locais.20RED/20GREEN. `src/infrastructure/execution-checklist-store.ts`; `tests/execution-checklist-store.test.ts`.
- [x] T3 — autorização por recurso, receipt replay, comparação da resposta SQL e rollback.13RED/13GREEN; revisão posterior acrescentou uma negativa RED/GREEN e um controle de compatibilidade, total 15. `src/application/execution-checklist.ts`; `tests/execution-checklist-recording.test.ts`. Houve correção de nomes errados na fixture da referência externa, não alteração do contrato do recurso.
- [x] T4 — montador interno com Auth/quotas/Origin/If-Match/chave/corpo limitado.15RED/15GREEN. `src/http/execution-checklist.ts`; `tests/execution-checklist-http.test.ts`.
- [x] T5a — candidato SQL e12cenários registrados no runner original, preservando D/E/G/capacidade. `supabase/candidates/hdn_execution_checklist.sql`, `supabase/tests/execution-checklist-scenarios.ts`, registro em `capacity-scenarios.ts`.
- [ ] T5b — executar e corrigir SQL no PG17 descartável; conferir tipo real/ACL/locks/concorrência/rollback e assertions. Falha de instalação não aprova cenários. A sessão atual não executou banco.
- [ ] T6 — publicador qualificado de templates/binding no intake e integração real de workflow. Nenhum template draft é ativado.
- [ ] T7 — gerar migration pela CLI, manifest/schema/readiness e upgrade da nova migration. SQL candidato não é migration pronta.
- [ ] T8 — UI de marcação, acessibilidade/browser, integração dos endpoints/runtime/OpenAPI e bypass das rotas antigas.
- [ ] T9 — CI da fonte completa e revisão independente; somente depois publicação técnica/aceite por escopo.

## Verificação
Rodada atual:99 testes anteriores +85 novos =184. Comando: `node --experimental-strip-types --test --test-reporter=tap tests/execution-checklist*.test.ts tests/support-workflow.test.ts tests/support-workflow-application.test.ts`.
Typecheck focal inclui o novo arquivo de cenários SQL; usa ferramentas globais, não npmci. Quatro mutações funcionais detectadas: atribuição, revisão, conta da evidência, ator do recibo. Logs preservados.
No checkout real: npmci, check:lock, check:migrations, npmtest, typecheck, check:contracts, check:secrets, build, audit e runner PostgreSQL/UI existentes. Não somar testes não executados ao resultado. Os testes SQL novos não foram executados nesta sessão.

## Foco da revisão
1. Transferência/revisão do ticket durante a marcação ou resolução; locks e contexto correto.
2. Dados de outro cliente/nota de outro autor ou recurso parcial; negar antes da escrita e da leitura privada.
3. ACK perdido, payload diferente na mesma chave e replay após revogação; no duplicate, no authority revival.
4. Snapshot anterior/risco/reset; não apagar história nem disfarçar execução.
5. Binding/template qualificados ausentes; negar, nunca publicar fixture.

Autorrevisão realizada em passagem separada. Sem ferramenta de subagente, não houve revisão independente. As limitações SQL, runtime e identidade qualificada não estão encerradas.

## Base final da integração
Base remota reconsultada: `fb4c7b943bc8e83541c000ba59f32fb2ab448914`. As três preimagens de workflow/registro SQL foram conferidas por Git blob. O login simplificado do PR28 não é alterado. Pacote local, sem commit/merge/CI/deploy remoto nesta rodada.
