# UX03-C + UX04 Implementation Plan

> **For agentic workers:** executar com superpowers:executing-plans; continuar sem refazer UX01–UX03.

**Goal:** painel opcional de abertura validado localmente e quatro superfícies de consulta no design Consulte GEO.
**Architecture:** módulos DOM existentes, funções de apresentação puras, CSS com escopo; state controllers e backend preservados.
**Tech Stack:** ES Modules, TypeScript node:test, Chromium/Playwright em bancada offline.
**Spec:** docs/design/HELPDESK_VISUAL_UX04_SPEC.md

## Global Constraints
Não auto-montar, não alterar API/SQL/grants/scopes/gate, não inferir filtros ou total a partir da página. Não distribuir fontes.

## Review Focus
Campos condicionais/lookup sem evento do host; boolean false; resposta tardia após clear; zero/null em métricas; notas internas extras em DTO.

### T1 — host opcional
Files: web/support-intake.js, web/support-intake.css, web/dynamic-form.js/.d.ts; scripts/visual-portal/browser-check.py.
- [x] Testar RED: salvar com inválido não chama API; estados de revisão/unknown; callback tardio e edição via picker.
- [x] Implementar layout do host, validação e evento opcional onAnswersChange no renderer; preservar estado existente.
- [x] GREEN: fluxo real dos módulos e parser com API controlada, teclado, limpeza.

### T2 — consulta
Files: web/portal-ui.js/.d.ts, customer-portal.js, support-queue.js, ticket-detail.js, reports.js, portal.css; tests/ux04-portal-values.test.ts; tests/ux04-dynamic-notifications.test.ts; tests/ux04-delivery.test.ts; tests/helpers/dom-port.ts.
- [x] RED: zero/null, objetos/HTML, textos/status, ausência de autorização, foco em rerender.
- [x] Implementar sem números/filtros inventados, manter assinatura antiga; atualizar estilos.
- [x] GREEN: Node + browser320/390/768/1024/1440 claro/escuro, estados distintos.

### T3 — integração e entrega
Files: scripts/build.mjs, tools/apply_ux04.py, MANIFEST.json, handoff/plano.
- [x] Copiar assets por lista explícita; não expor docs/testes/fixtures.
- [x] Verificar base/m02, regressão cumulativa; executar e registrar bloqueios completos.
- [x] Novo cumulativo reconhece base/UX01/UX02/UX03 integrais e recusa conflitos.
- [x] Empacotar código, evidências, previews, hashes e continuidade UX05.

## Fechamento local
65 testes Node focais no subconjunto; 93 verificações em Chromium com ports fictícios; 21 testes de aplicador em Git sintético. A fonte completa, o banco, Auth, HTTP/CSP e CI não foram aprovados.

- [ ] G0: aplicar e revisar as 14 ligações herdadas no app.js real, executar gates completos e homologar a integração.
- [ ] Publicação/aceite operacional: não realizados.

As etapas T1/T2 concluídas referem-se ao código de apresentação opcional e sua bancada; T3 entregue como pacote, não como merge/deploy.
