# Navegação dos links de email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir o chamado autorizado indicado no email depois do login.

**Architecture:** Capturar somente UUID de /support/tickets, limpar URL e manter intenção em memória até autenticação. A leitura atual do ticket exige novamente autorização do servidor; login ou URL nunca concede acesso.

**Tech Stack:** JavaScript browser, TypeScript tests, Netlify rewrite.

**Spec:** docs/superpowers/specs/2026-10-14-consultegeo-operacao.md

## Global Constraints

- Administração exige capability e MFA atuais.
- Não simular origem Novo GEO, principal, AAL2, grants ou protocolo legado confirmado.

## Review Focus

- URL com token/query/hash, ID malformado, encoded/nested path não vira intenção.
- Limpeza de URL falha: não reter intenção.
- Login recusado não consome a intenção; troca após login/saída descarta.
- Gate fechado não força leitura prematura.
- Ticket de outra conta continua recusado pelo endpoint autenticado.

### Task 1: Captura e montagem

**Files:** Create web/support-navigation.js/.d.ts, tests/support-navigation.test.ts. Modify web/app.js, scripts/build.mjs, netlify.toml.

**Interfaces:** captureSupportNavigation(location,history) returns frozen {hasTicket,takeTicket,clear,discarded}; closure-only UUID, no storage/token/remote requests. login consumes once only after /me and operational readiness, passing through existing detail loader.

- [ ] Write behavior tests of strict parsing/cleanup/single-use/logout and explicit app wiring/targeted rewrite. Observe RED.
- [ ] Implement strict capture and existing authenticated detail integration without arbitrary redirects, approvals or automatic mutations.
- [ ] Run focal Node tests/build and actual UI suite; record results.
- [ ] Commit with operational source qualification and independently review.
