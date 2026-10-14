# Plano de implementação — Help Desk visual UX07

**Goal:** adaptar conhecimento, macro, pacote, desenvolvimento e satisfação ao design system Consulte GEO.
**Architecture:** módulos ES nativos e apresentação opcional; operationsUI reutilizado, callbacks fornecidos pelo host. Estado de CSAT permanece local e recibos/replay conservam o contrato existente.
**Tech Stack:** JavaScript/TypeScript declarations, CSS tokens, Node test, Chromium/Playwright.
**Spec:** docs/design/HELPDESK_VISUAL_UX07_SPEC.md

## Restrições globais
Não alterar Auth/SQL/contratos de domínio/14 hooks herdados. Sem I/O no mount, sem armazenamento, sem links de grants. Só texto público de DTOs. Tipos 1–5 e comentário 2000 em CSAT. Datas originais UTC mantidas; horário somente para apresentação. Usar disposer e proteção de contexto nos callbacks tardios.

## Revisão prioritária
Troca de root/audiência com envio pendente; recibo errado de CSAT; expiração entre render e clique; status herdado de Object.prototype; assunto longo e foco móvel. Cada classe tem teste focal e, quando aplicável, browser.

## Tarefas
1. [x] Escrever `tests/ux07-support.test.ts`; rodar na implementação original e registrar RED.
2. [x] Criar `web/support-presentation.js/.d.ts`: mapas próprios, rótulos/validação do pacote e CSAT. Adaptar `optional-support.js/.d.ts`: lifecycle exclusivo, renderers e CSAT. Rodar testes até GREEN.
3. [x] Criar `web/support-experience.css`, incluir na lista de build, demo com MIME correto e index sem montar componentes. Criar teste de entrega em `tests/ux07-assets.test.ts`.
4. [x] Criar `scripts/visual-support/browser-check.py` e fixture sintética. Testar cinco superfícies, teclado/tema/reflow, pending/replay/dispose. Revisar screenshots. Rodar regressão dos testes presentes e registrar os gates integrais não aprovados.
5. [x] Atualizar cumulativo com schema7 e checkpoint UX06, preservar hashes de todos anteriores e dez guardas; testar aplicador em base/UX01…UX06 e rejeições. Gerar relatório, handoff, matriz e plano UX08/09; validar ZIP extraído/checksums.

Integração G0, revisão independente e publicação: pendentes, não fazem parte dos checkpoints locais concluídos acima.
