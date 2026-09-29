# M1-R2 Runtime Preflight — Implementation Plan

> Execução nesta sessão, em cópia isolada, com TDD. Revisão local; não há subagente/revisor independente disponível.

**Goal:** diagnosticar configuração e proteções do banco sem ativar o atendimento.
**Architecture:** validador puro compartilhado + probe READ ONLY de conexão única + CLI privada com opt-in de conexão.
**Tech Stack:** TypeScript, Node 22, pg 8.16.3, PostgreSQL 17.
**Spec:** docs/superpowers/specs/2026-09-28-runtime-preflight.md.

## Global Constraints
- API0.19/schema0.18 preservados; onze migrations imutáveis.
- Nenhum endpoint público ou alteração de autorização, flag, usuário ou segredo.
- npm ci/audit, PostgreSQL e navegador devem ser reportados separadamente de testes controlados.
- Snapshot de código reconstruído não é apresentado como clone do commit remoto.

## Review Focus
- Percent-encoding malformado deve falhar sem dados de conexão no erro.
- Configuração offline não pode importar driver, conectar ou ligar o gate.
- TLS ausente/não autorizado deve bloquear SQL.
- Falha em rollback/cleanup deve reprovar, sem esconder o erro principal nem reaproveitar conexão.
- Relatórios não devem transformar guards SQL em Auth, homologação de Function ou aprovação operacional.

## T1 — Configuração compartilhada
- [x] Testes negativos de URI malformada/tipos/controles e gate-first falham pela causa esperada.
- [x] Criar src/infrastructure/runtime-config.ts, mantendo exportação pública atual no runtime.ts.
- [x] Repetir novos testes e toda a suíte.

## T2 — Probe privado
- [x] Testes do probe: single connection, TLS, read-only, guards existentes, rollback, cleanup, erro sanitizado, nenhuma operação de negócio.
- [x] Criar src/infrastructure/runtime-preflight.ts; injeção de pool somente na API de teste, CLI usa exclusivamente o driver real.
- [x] Acrescentar casos SQL na suíte descartável existente, sem habilitar execução remota.

## T3 — CLI, evidências e handoff
- [x] Testes de CLI default offline, --connect explícito, argumentos inválidos e sigilo.
- [x] Criar scripts/runtime-preflight.ts e comando npm; sem nova dependência/lock editado.
- [x] Rodar baseline/final, migrations, contratos, build, typecheck disponível, tentativas de SQL/browser; preservar falhas.
- [x] Atualizar handoff/backlog/instruções e empacotar delta de aplicação e evidências reais.

## Ledger de execução
T1 concluída localmente:16casos iniciais RED/GREEN, depois2regressões no handler. T2 concluída localmente:27casos controlados;3SQL escritos, sem execução de banco. T3 concluída localmente:9CLI, documentação e pacote; gates reais de instalação/SQL/browser continuam pendentes. Nenhuma caixa marcada representa homologação de destino.

Decisão de revisão: cleanup do fixture de grant executa revoke mesmo quando aquisição/liberação da conexão falhar. Decisão de evidência: fonte reconstituída com fingerprint exato, entrega incremental para preservar docs/evidência remotos. Sem revisão independente disponível.
