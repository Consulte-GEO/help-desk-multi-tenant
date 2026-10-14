# UX06 — Plano de implementação

> Execução inline pela continuidade solicitada. Requisitos: plano UX05, seção 4, e `docs/design/HELPDESK_VISUAL_UX06_SPEC.md`.

**Goal:** padronizar cinco componentes operacionais sem mudar os comandos existentes.
**Architecture:** DOM nativo, helper de apresentação sem I/O e CSS com tokens. Controladores/validações existentes somente leitura. Nenhuma nova montagem no host.
**Tech Stack:** JavaScript ESM, CSS, Node22, Python/Playwright e Chromium.
**Spec:** `docs/design/HELPDESK_VISUAL_UX06_SPEC.md`.

## Restrições e foco de revisão
Preservar isolamento/audiência e fontes de dados; nenhum sucesso inferido de um estado intermediário; nada de token/URL privada em DOM/logs; foco estável e controles únicos; não executar ação de negócio ao montar ou conferir.

## Sequência
- [x] A. Testes RED e baseline verificável; nova apresentação compartilhada `web/operations-ui.js/.d.ts`, `web/operations-experience.css`.
- [x] B. `web/execution-checklist.js/.css`: progresso, estados, diálogo e seleção/foco; provas das recusas e reconciliação no controlador original.
- [x] C. `web/attachments.js`: substituir apenas mount; selecionar/remover antes do envio, estados explícitos, qualificar bytes confirmados sem inferir análise. Preservar blocos TUS/lote.
- [x] D. `web/approvals.js`, `web/form-review.js`, `web/delivery-operations.js`: apresentações por etapa; bloquear cliques repetidos e descartar respostas tardias; erro de estado desconhecido não vira sucesso.
- [x] E. Build/demo com lista explícita de assets e MIME correto; Node, bancadas e verificações de preservação; registrar gates não aprovados.
- [x] F. Cumulativo, aplicador com checkpoint UX05, testes sintéticos, revisão inline, matriz, plano e handoff.

## G0 externo à bancada
Checkout integral, 14 hooks anteriores, integração autorizada do host, tipos completos, CI, PostgreSQL, Auth e HTTP/CSP reais. Não promover prova local a deploy/homologação.

Fechamento local: 99 testes Node do subconjunto; 301 verificações Chromium UX06; 222 na regressão UX05. O G0 integral permanece aberto; as caixas acima registram implementação local e documentação das limitações, não implantação.
