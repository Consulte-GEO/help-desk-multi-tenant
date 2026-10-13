# Consulte GEO M09b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execução inline com uma revisão final independente.

**Goal:** Catálogo autorizado e rascunho/prévia/abertura duráveis no PostgreSQL, ligados à configuração publicada.

**Architecture:** Resolver CG e contexto SQL exatos; fábrica de perfil M04; helpers privados e cliente transacional emprestado. Runtime gated, origem ausente recusa.

**Tech Stack:** Node22/TypeScript, pg8.16.3, PostgreSQL17, CLI Supabase2.120.0, Web Request/Response, CI original.

**Spec:** `docs/superpowers/specs/2026-10-13-consultegeo-m09b-design.md`.

## Global Constraints

- Base785fa2d; preservar14migrations e candidatos M05. Schema0.22/API0.29, flag intakefalse.
- Novo GEO real não é simulado; server construction only; nenhum grant/seed/pool privilegiado no produto.
- Catálogo antes de LIMIT confirma conjunto completo; histórico/draft preserva versão imutável.
- Sem lookup/file qualificado, abertura que exige evidência recusa.
- SQL/receipt/CAS/checks compartilham transação; erro obrigatório sticky; sem retry automático.

## Review Focus

- App SQL arbitrário ou body com contexto válido de outra pessoa/conta não produz efeito.
- Contexto revogado/expirado durante espera nega metadata/receipt/COMMIT.
- Troca de versão/config/calendar/coverage em rascunho ou replay não altera o snapshot original.
- ACK ou efeito parcialmente suprimido/contraditório força rollback, inclusive quando capturado.
- Gate/cancelamento com COMMIT perdido não libera nova intenção nem declara confirmação.

### Task 1: Perfil publicado e admissão

**Files:** `src/application/consultegeo-intake-profile.ts`, `support-intake.ts`, `form-draft.ts`, `intake-context.ts`, testes respectivos.

**Interfaces:** produz IntakeProfile fixedPriority da entrada e política SLA fixada, sem campo impacto sintético. Admissão opcional atravessa resolver/transaction/store; Task2 implementa portas.

- [ ] Negativos antes: draft/corrupt/versão/priority/coverage, gate/cancel em esperas, fixedPriority inválida.
- [ ] Executar RED, implementar mínimo, GREEN; preservar perfis genéricos antigos.
- [ ] Commit com logs/ledger.

### Task 2: Migration e lojas SQL

**Files:** migrationCLI15, `consultegeo-intake-store.ts`, catálogo application, contratos schema/security e baselines, suítePG17.

**Interfaces:** lockScope(ctx), profile/form, draft CRUD/CAS, protocol reservation/receipt/commit usam RPCs com ctx validado. SQL consome somente contexto derivado do resolver; snapshot/effects em uma transação. Task3 monta factories.

- [ ] Escrever negativos Node/PG17 e preservar RED; gerar arquivo comCLI.
- [ ] Implementar helpers/tabelas/guards/ACL explícitos, parser sticky e snapshot pinning; atualizar metadata/manifest sem sobrescrever prefixo.
- [ ] Executar testes/CI até GREEN; provar rollback/concurrency/replay/isolation.
- [ ] Commit e ledger com resultado real.

### Task 3: HTTP/runtime e entrega

**Files:** handler catálogo/intake, runtime/config/Function flags, OpenAPI/versões, testesHTTP/runtime/browser adequados; docs144/evidence/pacote.

**Interfaces:** cinco operações, gate/source/origin, taxas/admissão atéCOMMIT; on-behalf/attachments indisponíveis. FrontendM09a permanece compatível.

- [ ] RED dos novos mounts/sourceausente/flags/admissão/métodos/origin/IfMatch/key.
- [ ] Registrar factories reais e OpenAPI, sem fake authority. GREEN tipos/build/contracts/focais.
- [ ] CI integral original, revisão fresh-context e único fix pass TDD; canonical/evidências exatas.
- [ ] Relatório/pacote/hash e PR31 draft. Sem merge/deploy/instalação remota.
