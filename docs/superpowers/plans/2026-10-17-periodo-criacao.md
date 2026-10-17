# Período de criação — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filtrar fila/totais pelo mesmo intervalo autorizado de criação, com precisão de microssegundos.

**Architecture:** Janela opcional UTC validada nos estados servidor/cliente, SQL parametrizado antes de LIMIT e conversão explícita de relógio SaoPaulo na interface. Reutiliza RLS, cursores, agregação e componentes existentes.

**Tech Stack:** Node22+/TypeScript, PostgreSQL17, JavaScript/Intl e Chromium; sem dependência ou migration nova.

**Spec:** `docs/implementation/PERIODO-CRIACAO-2026-10-17.md`.

## Global Constraints

`created_from` inclusivo e `created_before` exclusivo; UTC Z canônico3/6 dígitos; normalização sem perda; início menor que fim; audiência/permissões inalteradas; filtros ausentes preservam SQL/cursores anteriores; UI America/Sao_Paulo; sem MFA/Novo GEO/scanner/modelos técnicos/destinos MCP novos.

## Review Focus

- Igualdade nos extremos e precisão3/6 dígitos, inclusive cursor semanticamente equivalente.
- Filtro antes de LIMIT e totais completos; revogação viva e interseção privada por conta.
- Bindings com e sem localContexts/filtro interno, sem SQL interpolado de entrada.
- Datas impossíveis e lacunas/ambiguidades DST; fuso do dispositivo não altera a consulta.
- Formulário inválido/resultado atrasado preservam consulta aplicada; limpar/logout removem todos os valores.

## Tarefa1 — contrato e execução da janela

**Files:** application/ticket-search, infrastructure/postgres, HTTP handler/scoped, web/ticket-list-state e declarações, views/inbox-view-state, docs/openapi; testes ticket-created-window/ticket-created-window-adapter e supabase/tests/rls.

- [ ] Escrever/executar RED de gramática, microssegundos, ACL/totais/páginas/cursores e estado cliente.
- [ ] Implementar filtros opcionais normalizados e predicado parametrizado, mantendo posições antigas na ausência.
- [ ] Qualificar bindings locais/privados e semântica em PG17 real com login restrito; referências OpenAPI em ambas as operações.

## Tarefa2 — relógio e interface

**Files:** web/filter-instant.js +.d.ts, app/index/inbox-workspace, scripts/build e scripts/test-ui-local; testes filter-instant e browser-created-window.py.

- [ ] RED de conversão/gramática/DST e geração de query.
- [ ] Ligar dois datetime-local opcionais, feedback de validade, filtros aplicados/pendentes e consultas rápidas preservando período.
- [ ] Chromium com Auth/API sintéticas desktop/mobile390; capturas conferidas; nenhuma escrita de negócio.

## Tarefa3 — entrega independente

- [ ] Focais/tipos/45 contratos/build/lock/secrets e revisão independente somente leitura.
- [ ] PR e CI integral fonte/merge; preservar relatório/logs originais e qualificar prévia.
- [ ] Atualizar estado/documentação, recibos de produção70/71 e prontidão do novo PR. Não mesclar/publicar esse novo recorte sem autorização própria.

## Registro

Execução direta autorizada no pedido17/10. PR70/71 publicados/verificados antes desta implementação; base c24b759. HD019 permanece parcial; filtro por criação não é projeção de SLA, busca de mensagens nem relatório operacional.
