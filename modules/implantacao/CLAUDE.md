# CLAUDE.md — Implantação Consulte GEO

> **15/10/2026 — R05 revisada:** cumulativo integrado e qualificado no checkout completo Linux, PG17 descartável e Chromium. Corrigidos precisão decimal, snapshot grande, recuperação local e compatibilidade; auditoria zero. Vite6.4.3/plugin5.2.4/Vue3.5.42 substituem versões vulneráveis históricas. IMP-02 continua parcial, sem binding/backend/storage hospedados. Estado e evidências: [revisão Codex](IMPLEMENTATION-REPORT-V20-REVISAO-CODEX.md). Autorização direta desta conversa permite merge e publicação sem Claude.

> **Resumo operacional sujeito a revisão do mantenedor.** Escrito na v13 a partir da tarefa
> daquele ciclo e da leitura do próprio repositório. Onde este arquivo divergir dos documentos
> em `docs/` ou dos gates em `frontend/`, **o repositório manda** — corrija este arquivo.

## 1. O que é

Wizard web que substitui as planilhas Excel de implantação de obra: coleta estruturas, grupos,
concretos e peças, e gera **JSON técnico** + **exportação técnica em Excel** para o GEO Controle
Tecnológico. Backend de protótipo em Supabase; skeleton .NET 8 em `backend/` é o backend oficial
futuro (ver `docs/BACKEND_DOTNET_BLUEPRINT.md`).

## 2. Stack fechada

Vue 3 (Options API) · Vite 6 · TypeScript · **Vuex 4** · vue-router 4 · Bootstrap 5 + Design
System próprio · Supabase (`@supabase/supabase-js`), ref **`yglcnirbnbwjqpvalqif`** · deploy
Netlify em `setup.consultegeo.org` (site `setupobras`).

Monorepo: o app vive em **`frontend/`** — é por isso que `netlify.toml` tem `base = "frontend"`.
Fora dele: `backend/` (skeleton .NET), `supabase/` (migrations + Edge Functions), `tools/`
(runners de teste e geradores), `docs/`, `schemas/`, e as páginas estáticas de `frontend/public/`
(`importa.html`, `pre-analise.html`, `laudos.html`).

**Proibido neste projeto:** React, Next, Tailwind, Pinia, GraphQL. Também é proibido **remover o
Vuex** ou **remover o skeleton `backend/`** — os dois são decisão de arquitetura, não resíduo.

## 3. Vocabulário de interface

Termos válidos (`docs/PADRAO-KITS-PK.md` §7): Estruturas, Tipo de Estrutura, Número da Estrutura,
Grupo, Concreto, Peça, Pavimento, Etapa, Classificação, FCK, Volume, Projetista, Nomenclatura no
Sistema, Regra Aplicada, Prévia, Validação, Exportação técnica.

**Nunca na interface:** `Ges_*`, `Con_*`, `Utl_*`, `Pro_*`, `CTe_*`, "Grupo de Unidade",
"Unidade Tipo" — esses só em JSON técnico, aba de mapeamento, docs internas e relatórios da
equipe. **Nunca em lugar nenhum:** "MRV" e "Superestrutura" (renomeado para "Estrutura" na
v5.22.17; há gate no smoke conferindo que a literal não voltou).

Sem emoji na UI do produto. Sem hex/px avulso — só tokens do Design System.

## 4. Invariantes de dado

A referência completa é `docs/VALIDACOES.md` (VAL-001…VAL-050, em quatro níveis: Erro bloqueia
envio; Alerta segue com conferência; Sugestão; Pendência interna, visível só para a equipe).
Os que mais aparecem em revisão:

- **Tipo de Estrutura** restrito a Bloco/Torre/Contenção/Área Externa/Anexos/Apoio (VAL-001).
- **Projetista** é texto livre, opcional, **não bloqueia salvamento** (VAL-024, máx. 50 — VAL-012).
- Limites técnicos: Nomenclatura no Sistema 50 · Peça 100 · Código da obra 10 caracteres.
- **Volume** por unidade, ponto decimal no JSON técnico, **máximo 2 casas** (o `parseVolume`
  rejeita mais que isso desde a v5.22.7); vírgula é normalizada, não recusada (VAL-039).
- Toda estrutura/unidade gerada precisa de identificador temporário e vínculo (VAL-016/017/018) —
  `grupoTempId`, `concretoTempId`, `tipoTempId` no payload de exportação.
- **Nunca corrigir dado do usuário silenciosamente**: `customerInput` original é preservado; a
  normalização é uma camada à parte.

## 5. Gates obrigatórios

Rodar **todos** antes de abrir PR. Números são o esperado hoje:

| Gate | Comando | Esperado |
|---|---|---|
| Typecheck | `cd frontend && npm run typecheck` | 0 erros |
| Build | `cd frontend && npm run build` | exit 0 |
| Smoke geral | `cd frontend && npm run smoke` | 627 OK, 0 FAIL |
| Contraste | `cd frontend && npm run smoke:contrast` | 89 OK, 0 FAIL |
| Writer XLSX | `cd frontend && npm run smoke:xlsx` | self-test OOXML gera Estilos+Dados |
| Leitor de laudos | `node tools/run-laudo-tests.js` | 105 OK, 0 FAIL |
| Edge `laudo-vision` | `node tools/test-laudo-vision.mjs` | 28 OK, 0 FAIL (exige Deno) |
| Intake | `node tools/run-intake-tests.js` | 27/27 |
| Similaridade | `node tools/run-similarity-tests.js` | 21/21 |
| Importação | `node tools/run-implantacao-import-tests.js` | 23/23 |
| Auditoria de deps | `cd frontend && npm audit --omit=dev` | 0 vulnerabilidades |
| Browser (opcional) | `python3 tools/browser-validate-v10.py` | exige navegador real |

**Nunca alterar um gate para fazer teste passar** — inclusive `frontend/smoke-pipeline.ts`. Se um
gate falha, o problema é o código ou o arquivo: conserte a causa ou reporte. **Nunca declarar
validado o que não foi executado**; gate bloqueado por ambiente ou credencial vai para
"Bloqueios reais" do relatório.

⚠ **Windows:** com `core.autocrlf=true` o checkout usa CRLF e alguns gates do smoke medem
distância em caracteres dentro do arquivo. Isso pode produzir FAIL que não existe no Linux/CI.
Antes de tratar um FAIL desses como bug, meça com o conteúdo normalizado em LF. O caso vivo é o
`linkCopiedTimer`: 626 OK / 1 FAIL no Windows, 627 OK / 0 FAIL no CI.

⚠ **Deno instalado por `npm i -g deno` não é achado pelo gate no Windows:** o shim do npm é
`deno.cmd`, e o `spawnSync('deno')` do Node só executa `.exe`. Sem colocar
`%APPDATA%/npm/node_modules/deno` no `PATH`, o `tools/test-laudo-vision.mjs` responde **SKIP** —
que não falha o gate e parece aprovação. SKIP não é OK.

## 6. Fluxo de entrega

1. Branch **`claude/vNN-descricao-curta`** a partir de `main` atualizado.
2. Commits pequenos e descritivos, **em português**.
3. Bump em `frontend/package.json` — **numeração nunca é reutilizada**.
4. `IMPLEMENTATION-REPORT-VNN.md` na raiz: o que entrou, tabela de gates com resultado,
   bloqueios reais, pendências manuais, como validar.
5. `git push` da branch → **Pull Request** para `main` com o resumo do relatório.
6. **O merge exige autorização explícita do mantenedor (Thiago), por entrega.** Até 04/09/2026 a
   regra era "nunca mergear"; ela foi substituída, não relaxada. Sem um "pode mergear" dele
   **nesta** conversa, o fluxo termina no PR. Autorização de uma entrega não vale para a
   seguinte.

O merge em `main` **publica de verdade, em dois lugares**, e nenhum dos dois tem etapa de
aprovação depois:

- **Netlify** faz build de `frontend/` e vai ao ar em `setup.consultegeo.org`.
- **`.github/workflows/deploy-edge-functions.yml`** deploya as 7 Edge Functions em todo push em
  `main` que toque `supabase/functions/**`, `supabase/config.toml` ou o próprio workflow. O
  secret `SUPABASE_ACCESS_TOKEN` **existe desde 20/08/2026** — o job deixou de ser no-op verde.
  Migration que a função dependa precisa estar aplicada **antes** do merge, não depois.

## 7. Armadilhas conhecidas

- **`frontend/scripts/cleanup-legacy.cjs` apaga arquivos.** Roda como `prebuild`. Arquivo novo em
  `frontend/src/{components,services,models,views}` **precisa** entrar na allow-list dele **antes
  do primeiro build** — senão o build deleta o arquivo que você acabou de criar.
- **Herança do upload web.** Até a v12 as entregas subiam por upload web no GitHub, que **não
  deleta arquivo**, **não sobe caminho que começa com ponto** e **sobe o `INSTRUCOES.md` do zip**.
  A v13 limpou esses três rastros; a partir dela, publique **por git**.
- **`netlify.toml` tem precedência sobre a UI do Netlify** — `base`/`command` moram no
  repositório de propósito. Sem `base = "frontend"` o build falha com ENOENT `package.json`.
- **Sem CSP restritiva** por ora: `importa.html`, `pre-analise.html` e `laudos.html` executam
  script inline e uma CSP mal calibrada as quebra (ver `docs/SEGURANCA-RLS-PROPOSTA.md`).
- **Segredo nenhum no repositório.** `frontend/.env.example` leva só placeholders; a anon key real
  fica no Netlify e no `.env` local (ignorado). SERVICE ROLE KEY nunca em código de frontend.
- **Não tocar** em `supabase/migrations/` nem em `supabase/functions/` numa entrega de
  repositório/CI — banco e Edge Function têm ciclo próprio.
