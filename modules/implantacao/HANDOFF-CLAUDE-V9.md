# HANDOFF · Implantação Consulte GEO · V9 / v5.22.46

> Substitui `HANDOFF-CLAUDE-V8.md`. As afirmações da V8 sobre gates ("bloqueados
> pelo ambiente") não valem mais: os gates rodaram aqui e revelaram um erro de
> compilação real. Detalhes em `AUDITORIA-V9.md`.

## 1. Estado atual

- Versão: **5.0.22-46** · Copilot `importa.html` **3.4.0** · Pré-análise **5.22.46**
- Código: **compila** (`npm run build` limpo), typecheck limpo, 0 vulnerabilidades
- Testes: Pré-análise 27/27 · SimilarityEngine **21/21** · contraste 89/0 ·
  smoke 578 OK / 1 FAIL (workflow ausente, deliberado)
- **Produção está quebrada**: o Netlify serve o frontend V7 (`2f35b6cf…`) contra
  um banco já fechado por RLS. Salvar rascunho não funciona até publicar esta versão.
- Supabase: migrations V8 `016–023` aplicadas; **`005–015` nunca registradas**
- Push para o GitHub segue bloqueado pelo proxy desta sessão

## 2. As três coisas que importam agora

1. **Publicar o frontend** (resolve a produção). O frontend V9 usa RPCs por token;
   não há mais `.from()` nas tabelas fechadas.
2. **Três RPCs não existem no banco**: `return_submission_with_comment`,
   `resubmit_by_client_token`, `update_technical_json_by_client_token`. O
   `ticketService.ts` as chama → devolução/reenvio/edição do cliente quebram.
   Causa: a migration 009 usa `setup_submissions.client_token`, coluna que nunca
   existiu (o modelo real é `setup_tickets.access_token`).
   Diagnóstico reproduzível: `node tools/diagnose-schema-drift.mjs --repo-only`
3. **Writer XLSX é caseiro** (`frontend/src/vendor/xlsxStyleLite.ts`). A V8
   removeu `xlsx-js-style` por causa de um registry quebrado. Reavaliar a volta.

## 3. O que mudou nesta V9

```
frontend/src/views/SetupPage.vue             guard de `id` (destrava o build)
frontend/public/assets/similarity-engine.js  5 bugs corrigidos
frontend/public/assets/similarity-selftest.js +9 testes de regressão (S13–S21)
frontend/src/vendor/xlsxStyleLite.ts         3 bugs corrigidos
tools/diagnose-schema-drift.mjs              NOVO
AUDITORIA-V9.md                              relatório completo
```

Bugs do SimilarityEngine: propunha traço **sem nenhum FCK** dizendo "compatível";
slump em mm virava cm (`100 mm` → `100 cm`); `SLUMP12` sem espaço não casava;
`reject()` rebaixava `DADO_ORIGINAL` para `PENDENTE_CLIENTE`; `row` null quebrava.
Bugs do writer: aba duplicada case-sensitive, `NaN`→`0` silencioso, sem limite de
32.767 caracteres.

## 4. Armadilhas

- `frontend/package.json` tem `"type":"module"` — módulos UMD exigem carga explícita
- O Copilot ativo é `frontend/public/importa.html`; o histórico está em `prototype/v06/`
- Netlify: `base="frontend"`, `publish="dist"` — nunca publicar a raiz
- Migrations 016–023 já aplicadas: não editar; só incrementais
- Testes que passam não garantem contrato: os S1–S12 da V8 passavam **escondendo**
  dois dos bugs (foram escritos em torno da implementação)

## 5. Como retomar em 5 passos

```bash
cd frontend && npm ci && npm run build && npm run typecheck && npm run smoke:all
cd .. && node tools/run-intake-tests.js && node tools/run-similarity-tests.js
node tools/diagnose-schema-drift.mjs --repo-only     # SQL de verificação do banco
python3 -m http.server -d frontend/dist 8080         # /importa.html /pre-analise.html /
# publicar em preview, validar, e só então promover produção
```
