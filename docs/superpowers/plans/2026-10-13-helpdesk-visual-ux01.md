# Help Desk — adaptação visual UX01 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** padronizar as superfícies existentes no visual Consulte GEO derivado do DS GEOLAB, preservando o núcleo genérico.

**Architecture:** CSS aditivo com tokens semânticos, perfil de marca somente de apresentação, inicialização de tema isolada e melhorias progressivas de navegação/semântica. Nenhum acesso à API na camada visual.

**Tech Stack:** HTML, CSS, JavaScript ESM, Node 22, Python/Playwright Chromium.

**Spec:** `docs/design/HELPDESK_VISUAL_UX01_SPEC.md`.

## Global Constraints
Preservar `app.js`, Auth, gates, enums, UUIDs, contratos, migrations e estados hidden/inert/disabled. Não distribuir fontes. Nenhuma escrita ou publicação remota. Não anunciar CI ou operação reais com base na bancada visual.

## Review Focus
Login simples precisa continuar simples mesmo após tema/menu. Módulos ocultos não podem aparecer por CSS. Carga longa/UUID não pode alargar a página. Campo obrigatório/rascunho/limites não podem mudar. Marca neutra precisa continuar sendo apenas apresentação.

### Tarefa 1 — congelamento e diagnóstico
- [x] Ler branch real, SHA, implantação e referências do anexo/GEOLAB.
- [x] Obter index, styles e build; conferir Git blob SHA antes de qualquer alteração.
- [ ] Completar matriz de todas as superfícies/componentes encontrados e distinguir alcançável/opcional/desativado.

### Tarefa 2 — fundação e identidade
**Files:** criar `web/brand-profile.js`, `.d.ts`, `web/theme-init.js`, `web/design-tokens.css`, `web/consulte-theme.css`, `web/brand-shell.js`, `web/assets/consulte-geo-*.png`; modificar apenas wiring de `web/index.html` e `scripts/build.mjs`.
**Interfaces:** `getBrandProfile(unknown): BrandProfile`; `themePreference(unknown): ThemePreference`; `mountBrandShell(Document): { dispose(): void }`. Sem cliente HTTP ou credencial.
- [ ] Escrever testes `tests/visual-branding.test.ts` e observar RED.
- [ ] Implementar perfis fechados e tema resiliente a storage negado.
- [ ] Implementar tokens, primitivos, layout, formulários, cards, diálogos e temas.
- [ ] Implementar decoração de marca, ícones, disclosure móvel, foco e nomes acessíveis sem trocar handlers.
- [ ] Testar e revisar o diff contra os invariantes.

### Tarefa 3 — bancada browser e integração
**Files:** criar `scripts/visual-branding/browser-check.py`, `scripts/visual-branding/fixture.js` e `docs/design/HELPDESK_VISUAL_UX01_MATRIX.md`.
- [ ] Executar contra HTML original e candidato com controlador de negócio desabilitado explicitamente.
- [ ] Validar transições de apresentação, formulário nativo, teclado, ocultações, overflow, contraste e assets.
- [ ] Registrar screenshots desktop/mobile e logs, nunca dados ou segredos reais.
- [ ] Executar gates integrais quando houver checkout completo; caso ausente, registrar os comandos bloqueados sem fabricar fontes/fixtures para passar.

### Tarefa 4 — entrega e continuidade
- [ ] Reinspecionar SHA remoto para identificar divergências concorrentes.
- [ ] Gerar patch/delta com precondições, hashes, fontes alteradas, validação idempotente e handoff.
- [ ] Detalhar pendências por tela, fases UX02+ e integração com M02/V4.
- [ ] Validar ZIP, ausência de fontes/segredos, integridade e aplicação em cópia limpa.


## Registro final da execução — UX01

Fundação visual implementada no recorte isolado, sem escrita remota. O arquivo original de estilo foi mantido; o HTML, o build e a allowlist do servidor local receberam deltas. A inspeção dos arquivos opcionais distingue leitura completa e apenas identificação. Consulte a auditoria de 43 superfícies e o plano de continuidade entregues no pacote.

Verificações: oito testes focais, matriz visual offline, pares semânticos de contraste e preservação do HTML. A integração completa não foi realizada. Registros integrais estão no diretório de evidências do pacote, não são evidência de homologação de produção.

Decisão registrada: usar bancada offline com DOM/CSS/ESM nativos porque a navegação estava bloqueada por política; manter HTTP/CSP/armazenamento real/E2E como pendências e não alterar políticas.

Correções verificadas: decoração de rótulo externo; allowlist dos novos assets no servidor de demonstração. A revisão independente e os gates do checkout integral ficam para o Codex.

Nenhum commit, push, merge, migration remota ou deploy foi executado. O plano original descreve tarefas locais; o plano de continuidade do pacote é a referência das próximas etapas.
