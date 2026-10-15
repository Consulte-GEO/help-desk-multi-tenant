# Auditoria técnica · Implantação Consulte GEO — V7 (v5.22.44)

Data: 07/08/2026 · Base auditada: `main` @ `d0130b9` + correções da v5.22.43
Método: varredura estática do repositório (224 arquivos versionados), execução
real dos gates (`npm ci`, `build`, `typecheck`, `smoke:all`, `npm audit`),
inspeção das migrations Supabase e validação em browser (Chromium/Playwright)
sobre o `dist` gerado.

---

## 1. Sumário executivo

| Área | Situação |
|---|---|
| Segredos e credenciais | **OK** — nenhum `.env` versionado, nenhuma chave hardcoded, `service_role` restrita a Edge Functions |
| **RLS do Supabase** | **CRÍTICO** — 4 tabelas abertas ao papel `anon` (leitura/escrita/remoção de tudo) |
| Dependências | **Corrigido** — 1 vulnerabilidade HIGH (postcss) → 0 vulnerabilidades |
| Build / tipos | **OK** — build e `vue-tsc` limpos |
| Acessibilidade | **2 violações WCAG nível A corrigidas** nesta versão |
| Conformidade (MRV, termos de banco, stack) | **OK** — zero violações |
| Consistência de versão | **Corrigido** — 4 versões divergentes → 1 |
| Documentação | **Parcialmente corrigido** — README reescrito; 3 docs ainda divergem do código |
| Organização do repo | **Achado médio** — resíduos do protótipo na raiz convivem com o sistema |

Um achado crítico (RLS) e um pré-existente (workflow de Edge Functions) permanecem
**abertos por decisão consciente** — ver §5.

---

## 2. Achado crítico · RLS aberta para `anon`

`setup_drafts`, `setup_submissions`, `setup_audit_events` e `setup_exports` têm
policy `for all to anon using (true) with check (true)`.

A `anon key` é pública por design — viaja no bundle JavaScript. Em Supabase, quem
protege os dados é a RLS. Com `using(true)`, qualquer visitante pode listar,
alterar e **apagar** rascunhos e submissões de todos os clientes, e ainda
adulterar a trilha de auditoria (`setup_audit_events`), que o projeto define como
obrigatória. O `snapshot` dos rascunhos carrega responsável, e-mail e telefone —
dado pessoal, com implicação de LGPD.

Não é desconhecimento do padrão: as tabelas mais recentes já usam
`using(false)` + funções `security definer` com token (`setup_tickets`,
`setup_review_comments`, `setup_admin_*`). As quatro acima ficaram para trás.

**Não corrigi automaticamente** porque `setupDraftService.ts` depende hoje desse
acesso aberto para salvar rascunho — aplicar o endurecimento sem migrar o
frontend quebraria a aplicação em produção. O plano em 3 fases, com o SQL pronto,
a medição de impacto por tabela e o roteiro de validação está em
**`docs/SEGURANCA-RLS-PROPOSTA.md`**. A Fase 1 (`setup_submissions`, cujo serviço
é órfão) é de risco baixo e pode ir primeiro.

---

## 3. Corrigido nesta versão

### 3.1 Segurança
- **postcss** `<=8.5.22` (path traversal, severidade HIGH, transitiva do Vite) →
  `npm audit fix`; auditoria agora reporta **0 vulnerabilidades**.
- **`.env.example` criado.** Não existia — violava o critério de aceite do projeto
  e deixava as 4 variáveis `VITE_*` sem contrato versionado. O arquivo documenta
  explicitamente que a anon key é pública e que a `service_role` jamais entra no
  frontend.
- **Headers de segurança no `netlify.toml`**: `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e HSTS —
  `docs/NETLIFY.md` já os prometia, mas não existiam na configuração real.
  CSP restritiva ficou de fora de propósito: `importa.html`, `laudos.html` e
  `pre-analise.html` executam script inline e uma CSP mal calibrada as quebraria.

### 3.2 Acessibilidade (WCAG 2.1 nível A)
- **2.1.1 Teclado** — o handle de reordenar (`⠿`) era um `<span>` sem `tabindex`,
  sem `role`, sem nome acessível e sem handler de teclado: reordenar linhas era
  impossível sem mouse. Agora é `role="button"`, `tabindex="0"`, com `aria-label`
  contextual e setas ↑/↓ ligadas a `moveGrupoTeclado`/`movePecaTeclado`, que
  reusam as ações `reorder-grupos`/`reorder-pecas` já existentes (com clamp e
  idempotência no store — nenhuma lógica nova de reordenação foi criada).
- **1.3.1 / 3.3.2 Rótulos** — 12 controles das tabelas de Estruturas e de
  Peças ficavam sem nome programático (só `placeholder`, que não é rótulo).
  Todos receberam `aria-label` contextual com o número da linha.
  Arquivos: `Step3GruposEditor.vue`, `Step5PecasEditor.vue`.

### 3.3 Consistência e documentação
- **Versões unificadas.** Circulavam quatro: `5.0.22-43` (package.json), `5.22.43`
  (publicado), `5.23.0` (resíduos da raiz, à frente do que ia ao ar) e `3.2.0`
  (Copilot). Agora: `5.0.22-44` / `5.22.44` em todos os módulos da Pré-análise
  (publicados e resíduos) e Copilot `3.3.0`.
- **README reescrito.** Estava contraditório com o deploy real — mandava publicar
  a raiz com `publish = "."` e "sem build step", enquanto o `netlify.toml` usa
  `base=frontend` + `npm run build`. Agora descreve a estrutura real, o build, os
  testes, o deploy e os resíduos conhecidos.

---

## 4. Achados sem correção automática (com justificativa)

| # | Achado | Severidade | Por que não corrigi |
|---|---|---|---|
| 1 | RLS aberta (§2) | Crítica | Quebraria o salvamento de rascunho; exige migração para RPC + validação contra o banco real. Plano completo em `docs/SEGURANCA-RLS-PROPOSTA.md` |
| 2 | `.github/workflows/deploy-edge-functions.yml` ausente (1 FAIL no `smoke`) | Média | Pré-existente (o repo nunca versionou `.github/`). Publicar Edge Functions exige `SUPABASE_ACCESS_TOKEN` em secrets; um workflow incompleto quebraria o CI |
| 3 | `frontend/public/laudos.html` — 2,5 MB, pdf.js minificado inline (uma linha de 974 mil caracteres) | Alta | Extrair para `public/vendor/` é refatoração com risco de regressão numa página que não pude testar com PDFs reais. Recomendado para o próximo ciclo |
| 4 | `setupSubmissionService.ts` órfão (não importado por ninguém) | Média | Remover exigiria confirmar que nenhum fluxo futuro o usa; está no allow-list do `cleanup-legacy.cjs`. Sugerido: remover ou documentar como reservado |
| 5 | Resíduos do protótipo na raiz (`assets/`, `emails/`, `index.html`, `importa.html` de 5,5 KB, `_redirects`) | Média | Não são publicados, mas confundem: há dois `importa.html` com o mesmo nome e propósitos distintos. Não removi (regra do projeto: evitar hard delete); documentei no README |
| 6 | `xlsx.full.min.js` versionado 2× (1,7 MB) | Média | O da raiz serve o protótipo; o de `frontend/public/vendor/` serve as páginas publicadas. Resolve junto com o item 5 |
| 7 | `docs/EXPORTACAO_TECNICA_EXCEL.md` cita 7 abas (o código gera 13) e um caminho inexistente (`src/utils/excelExport.ts`, lib `xlsx` — a real é `xlsx-js-style`) | Baixa | Correção de documentação de conteúdo, fora do escopo desta auditoria |
| 8 | `docs/NETLIFY.md` divergia (`publish = "frontend/dist"`, `NPM_VERSION`) | Baixa | Os headers que ele prometia foram implementados (§3.1); o restante do texto merece revisão |
| 9 | 2 TODOs em `AdminDashboardView.vue` (DELETE de priority não implementado) | Baixa | Débito funcional conhecido, sem impacto de segurança |
| 10 | `Step3GruposEditor.vue` modo "comum" usa lista de tipos diferente (inclui Casa/Estrutura, sem Anexos/Apoio) | Baixa | O rótulo ali é "Tipo visível na obra", não "Tipo de Estrutura" — não classifiquei como violação. Vale confirmar a intenção |

---

## 5. Conformidade verificada (sem violações)

- **MRV**: zero ocorrências em interface. As correspondências encontradas são
  falso-positivo em blob minificado (`laudos.html`), hash de `package-lock.json`,
  ou o próprio texto normativo que proíbe o termo.
- **Termos internos de banco** (`Ges_`, `Con_`, `Utl_`, `CTe_`, `Pro_`): zero em
  `.vue` e nas páginas públicas. Aparecem só onde é permitido — `excelExportService.ts`
  (aba "Mapeamento Banco"), models e JSON técnico.
- **Substituições obrigatórias** aplicadas: "Tipo de Estrutura", "Número da
  Estrutura", "Nomenclatura no Sistema", "Regra Aplicada", "Adicionar linha",
  "Carregar exemplo completo com projetista".
- **Stack**: Vue 3 + Vite + TS + **Vuex 4** + Bootstrap 5. Zero React/Next/Tailwind/Pinia.
- **Projetista**: texto livre, sem `required`, ausente dos `VALIDATION_CODES` —
  não bloqueia salvamento.
- **Tipo de Estrutura**: as 6 opções corretas em `TIPO_ESTRUTURA_MODELO_PROJETO`.
- **Backend .NET, schemas, docs e relatórios anteriores**: preservados.

---

## 6. Gates executados

| Gate | Resultado |
|---|---|
| `npm ci` / `npm install` | OK |
| `npm run build` | OK (~7s) |
| `npm run typecheck` (vue-tsc) | OK |
| `npm run smoke:contrast` | **89 OK, 0 FAIL** |
| `npm run smoke` (pipeline) | **578 OK, 1 FAIL** (pré-existente, item 2 do §4) |
| `npm audit` | **0 vulnerabilidades** (era 1 HIGH) |
| `node --check` (JS inline do `importa.html` + 3 módulos da Pré-análise) | OK |
| Self-test da Pré-análise (browser) | **27/27** (C1–C20 + T21–T27) |
| Não-regressão: Pré-importação e Pós-importação sobre o `dist` | OK |
| `aria-label`/handlers de teclado presentes no bundle compilado | Verificado |

---

## 7. Próximo ciclo recomendado

1. **RLS — Fase 1** (`setup_submissions`): risco baixo, fecha uma superfície hoje
   aberta sem tocar no frontend.
2. **RLS — Fase 2** (auditoria append-only) e depois **Fase 3** (rascunhos por token).
3. Extrair o pdf.js de `laudos.html` para `public/vendor/` (item 3).
4. Limpeza dos resíduos da raiz (itens 5 e 6) — mover para `prototype/` ou `docs/`.
5. Decidir sobre o workflow de Edge Functions (item 2).
6. Atualizar `docs/EXPORTACAO_TECNICA_EXCEL.md` e `docs/NETLIFY.md` (itens 7 e 8).
