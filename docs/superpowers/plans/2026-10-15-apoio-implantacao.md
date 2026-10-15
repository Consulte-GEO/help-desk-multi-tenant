# Apoio Implantação — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disponibilizar todos os recursos existentes da Implantação dentro do Help Desk, para suporte/admin, sem scanner.

**Architecture:** Módulo Vue ESM carregado na área nativa Help Desk; motores existentes adaptados a montagem/desmontagem. API autenticada e addon privado no banco Help Desk preservam core e dados antigos. IA é um port servidor com SDK oficial e quota.

**Tech Stack:** Node22, TypeScript, PostgreSQL17, Netlify Functions, Vue3.5.42/Vite6.4.3, OpenAI SDK7.34.0, motores XLSX/PDF existentes.

**Spec:** `docs/superpowers/specs/2026-10-15-apoio-implantacao-design.md`.

## Restrições e revisão

- Nunca conceder acesso a clientes/integrações por simplesmente mostrar/ocultar menu.
- Preservar21 migrations/quatro schemas/core0.27, autores e snapshots existentes.
- Não publicar fontes privadas, funções legadas administrativas ou segredos.
- Não marcar arquivo clean/ready sem evidência; antivírus não integra esta entrega.
- Não perder rascunhos após logout/conta trocada nem aceitar respostas de sessão antiga.
- Verificar planilhas grandes/múltiplas abas, PDF cancelado, campos ilegíveis, empate IA e CAS concorrente.

## Tarefas

- [x] Inventariar três páginas, serviços, motores e fontes; confirmar acesso interno com o usuário.
- [x] Trazer439 arquivos e proveniência para `modules/implantacao`, excluindo scanner/evidências voláteis.
- [x] Integrar sidebar/lifecycle em `web/app.js`/`index.html` e facade `implementation-support.js`; testes negativos de sessão/async.
- [x] Compilar `modules/implantacao/frontend` como biblioteca `support-app.js`; adaptar UI/serviços e escopar controllers sem iframe/eval.
- [x] Preservar os fluxos de preparação e ligar pré-análise à conversão real; testar modelos/exportações/localparse e cancelamento. Documentar limites de originais/e-mail/Novo GEO.
- [ ] Implementar addon SQL privado, repositório/HTTP/runtime com gate humano e isOperator; testar CAS, replay, autorização e PG17 com core real.
- [x] Adaptar IA para SDK oficial/Netlify, modelos verificados e contratos antigos validados; testes sem custo com SDK injetado.
- [x] Incluir biblioteca/assets explicitamente em build/demo, locks/CI e fingerprint; ampliar CSP só onde recursos exigem.
- [ ] Rodar tipos, contratos, motores/frontend, segurança, build e CI integral/PG/browser. Corrigir achados de revisão independente.
- [ ] Commit/merge/publicar código compatível, aplicar somente addon qualificado e conferir produção sem dados fictícios ou inferência paga.
- [ ] Registrar evidências, paridade, pendências reais e preservação do site/histórico Setup.
