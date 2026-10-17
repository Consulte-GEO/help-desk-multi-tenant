# Ordem de criação — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Consultar chamados antigos primeiro com paginação completa e as permissões atuais.

**Architecture:** `sort=oldest` opcional no estado normalizado da consulta; SQL e memória ordenam o universo autorizado antes de LIMIT. Reutilizar o resumo, cursor e estado visual existentes.

**Tech Stack:** TypeScript/JavaScript, Node22, PostgreSQL17 e Chromium. Sem migration/dependência nova.

**Spec:** `docs/implementation/ORDEM-CRIACAO-2026-10-17.md`.

## Global Constraints

Ausência/newest mantêm a ordem e os cursores existentes. Oldest usa created_at/id ascendentes e cursor estritamente maior. Precisão3/6, autorização e revogação preservadas; nenhuma ordenação só da página cliente. MFA/Novo GEO adiados, scanner cancelado e modelos técnicos ausentes permanecem fora do recorte.

## Review Focus

- Empates/microssegundos e mais de uma página, sem lacunas/duplicação em cada direção.
- Mudança de ordem invalida cursor e respostas em voo; newest explícito equivale ao padrão.
- SQL interpolado somente de constantes e bindings locais/privados inalterados.
- Totais iguais para a mesma audiência e filtros; ordem não concede leitura nem filtro privado.
- Campo pendente/consulta aplicada, consultas rápidas, limpar/logout, teclado/mobile.

## Tarefa1 — contrato, execução e paginação

- [x] RED em tests/ticket-created-sort.test.ts e tests/ticket-created-sort-adapter.test.ts: gramática,153 linhas/páginas7/microssegundos/ACL/revogação, cursor, HTTP e client-state.
- [x] Implementar ticket-search, memory/postgres, allowlists core/scoped e OpenAPI das duas rotas, mantendo SQL/binds antigos na ausência.
- [x] Acrescentar teste PG17 real de ordenação/cursores e revogação em supabase/tests/rls.test.ts; verificar no CI Linux com login restrito, sem contornar o guard Windows.

## Tarefa2 — interface

- [x] RED em tests/browser-created-sort.py; seletor, pendência/aplicação e indicação da ordem realmente aplicada.
- [x] Ligar app/index, inbox-view-state/inbox-workspace, ticket-list-state e ticket-views; preservar ordem em consultas rápidas e remover em limpar/logout.
- [x] Executar navegador real desktop/mobile390 com Auth/API sintéticas, capturas conferidas e nenhuma escrita.

## Tarefa3 — qualificação e entrega

- [x] Focais, tipos, contratos, build, lock/segredos; revisão independente somente leitura da branch inteira.
- [x] PR para revisão e CI integral da fonte/merge; preservar relatório/logs originais e conferir preview do head final.
- [x] Atualizar estado e documentação com publicação PR72 e resultados reais; não mesclar/publicar o novo PR sem autorização própria.

## Registro

Execução direta autorizada. Ruling: normalizar newest para ausência — preserva cursor anterior e evita duas representações da mesma consulta; oldest altera somente ordenação e cursor, não as contagens.
