# Período de atualização — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. Steps use checkbox syntax for tracking.

**Goal:** Filtrar lista e totais autorizados pela janela de atualização do ticket.

**Architecture:** Estender o fluxo existente de datas com dois filtros normalizados e predicado SQL parametrizado. Reutilizar controles/estados e conversão Brasília sem alterar ordenação por criação.

**Tech Stack:** TypeScript/Node22–24, PostgreSQL17, JavaScript/Intl e Chromium; sem dependência nova.

**Spec:** `docs/implementation/PERIODO-ATUALIZACAO-2026-10-17.md`.

## Global Constraints

`updated_from` inclusivo/`updated_before` exclusivo; UTC3/6; SQL e cursores existentes compatíveis quando ausentes; interseção com criação; filtros antes de LIMIT/totais; UI Brasília; mesmos ACL/grants; sem interpretação SLA/última resposta; sem produção ou merge novo.

## Review Focus

- Atualização difere de criação: coluna correta, mantendo ordem/cursor por criação.
- Interseção de quatro limites com todos os parâmetros opcionais, sem binding deslocado.
- Atualização concorrente entre páginas é leitura viva, sem promessa de snapshot.
- Outra conta/pessoa/obra e revogação não participam de páginas/totais.
- Invalidade/DST/pendência e respostas antigas preservam a consulta aplicada; limpar/logout removem valores.

## Task 1 — janela de atualização completa

Interfaces: TicketListOptions/TicketSearchFilters opcionais; predicado compartilhado lista/resumo; mesmas chaves em HTTP/scoped, estados cliente, consultas rápidas e OpenAPI. Controles updated-from/updated-before usam saoPauloFilterInstant existente.

- [ ] Escrever e executar RED nos testes de domínio/SQL adapter/HTTP/estado e browser.
- [ ] Implementar normalização, predicado parametrizado, query/contrato e controles/feedback.
- [ ] Qualificar janelas combinadas, cursor, ACL e alteração real em PG17 restrito; browser desktop/mobile390.
- [ ] Verificar focais/tipos/contratos/build/lock/segredos e revisão independente readonly; corrigir achados com RED/GREEN.
- [ ] Commit/push/PR separado e CI fonte/merge; preservar relatório/logs originais.
- [ ] Qualificar prévia e head final, atualizar estado/handoff; sem merge/publicação.
