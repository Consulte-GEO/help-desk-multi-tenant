# Implementation Report · Implantação Consulte GEO v5.18

## Resumo executivo

Code-split do `@supabase/supabase-js` (vendor-supabase, ~53 KB gzip)
para fora do bundle inicial via dynamic import em `services/supabaseClient.ts`.
`getSupabase()` síncrono virou `getSupabaseAsync()`; os 4 services
consumidores foram atualizados para `await`. Warm-up oportunista no
`mounted` do SetupPage esconde a latência do 1º save.

**Resultado: first-load JS gzip cai de 123,36 KB para 68,85 KB (−44 %).**

Combinado com a v5.16 (xlsx) e v5.15 (CSS contrastes), o protótipo tem
agora a menor superfície eager possível sem mudar a stack ou remover
Bootstrap.

Stack fechada respeitada, backend .NET skeleton intacto, smokes 32+42
verdes.

## Ambiente usado

- Node 22.22.2 (compatível Node 20+)
- Vue 3.4.38 + Vite 5.4.6 + TS 5.4.5 + Vuex 4.1 + Bootstrap 5.3.3
- `@supabase/supabase-js@^2.45.4` continua como dependência (apenas
  carregada dinamicamente em runtime agora)

## Arquivos criados

- `IMPLEMENTATION-REPORT-V518.md` (este arquivo)

## Arquivos alterados

- `frontend/src/services/supabaseClient.ts`
  (reescrito: 50 → 98 linhas — adiciona lazy loader e `getSupabaseAsync`)
- `frontend/src/services/setupAuditService.ts`
  (2 chamadas trocadas — `getSupabase()` → `await getSupabaseAsync()`)
- `frontend/src/services/setupDraftService.ts`
  (4 chamadas trocadas)
- `frontend/src/services/setupExportService.ts`
  (2 chamadas trocadas)
- `frontend/src/services/setupSubmissionService.ts`
  (3 chamadas trocadas)
- `frontend/src/views/SetupPage.vue`
  (import de `preloadSupabase` + chamada no `mounted` hook)
- `frontend/vite.config.ts`
  (comentário atualizado)
- `frontend/package.json` (version 5.0.17 → 5.0.18)

## Arquivos removidos

- Nenhum.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| Cópia v5.17 → v5.18 | OK | base limpa |
| Reescrita `supabaseClient.ts` | OK | API: `getSupabase` → `getSupabaseAsync` |
| `sed` em 4 services para `await getSupabaseAsync()` | OK | padrão idêntico, refactor automatizado |
| Verificação que todas as funções afetadas já eram `async` | OK | 11 funções, 11 já `async` |
| `npm install` | OK | sem dependências novas |
| `npm run typecheck` (`vue-tsc --noEmit`) | OK | 0 erros |
| `npm run build` | OK em 6,02s | bundle redistribuído |
| `npm run smoke` | **32 OK / 0 FAIL** | lógica preservada |
| `npm run smoke:contrast` | **42 OK / 0 FAIL** | contraste preservado |
| `npm run smoke:all` | OK encadeado | |
| `grep modulepreload dist/index.html` | 3 entradas | `vendor-supabase` fora |

## Resultado dos comandos

### Comparativo de chunks first-load (gzip)

| Chunk | v5.17 (status) | v5.18 (status) | Delta |
|---|---|---|---|
| `index-*.js` | 27,93 KB / **eager** | 28,01 KB / **eager** | +0,08 KB |
| `vendor-vue-*.js` | 26,74 KB / eager | 26,74 KB / eager | 0 |
| `vendor-vue-router-*.js` | 10,09 KB / eager | 10,09 KB / eager | 0 |
| `vendor-vuex-*.js` | 4,02 KB / eager | 4,02 KB / eager | 0 |
| `vendor-misc-*.js` | 1,84 KB / **eager** | 1,84 KB / **lazy** | −1,84 KB |
| `vendor-supabase-*.js` | 52,74 KB / **eager** | 53,50 KB / **lazy** | **−52,74 KB** |
| **Total first-load JS gzip** | **123,36 KB** | **68,85 KB** | **−54,51 KB (−44 %)** |

CSS sem alteração: `index.css` 4,84 KB + `vendor-bootstrap.css` 30,69 KB.

**First-load total (JS+CSS gzip): de 158,89 KB para 104,38 KB — −34 %.**

### Comparativo histórico (v5.14 → v5.18)

| Versão | First-load JS gzip | Cumulativo |
|---|---|---|
| v5.14 (base original) | ~130,11 KB | — |
| v5.15 (contraste, CSS only) | 130,11 KB | 0 |
| v5.16 (code-split xlsx service) | 123,36 KB | −6,75 KB |
| v5.17 (smoke contrast, dev-time only) | 123,36 KB | 0 |
| **v5.18 (code-split supabase)** | **68,85 KB** | **−61,26 KB (−47 %)** |

### Modulepreload no dist/index.html

```html
<link rel="modulepreload" href="/assets/vendor-vue-*.js">
<link rel="modulepreload" href="/assets/vendor-vue-router-*.js">
<link rel="modulepreload" href="/assets/vendor-vuex-*.js">
```

Comparativo: v5.17 tinha 5 entradas (essas + `vendor-misc` + `vendor-supabase`).
A v5.18 baixou para 3.

## Implementado com sucesso

- **`supabaseClient.ts` reescrito**:
  - `import type { SupabaseClient }` (type-only — não vai pro bundle)
  - `loadSupabaseModule()` memoiza a Promise do dynamic import
  - `getSupabaseAsync()` é a nova API pública
  - `preloadSupabase()` para warm-up oportunista
  - `_warnedOnce` evita spam de console em modo local-only
- **4 services refatorados** com sed em massa (padrão uniforme):
  - `setupAuditService` · 2 callsites
  - `setupDraftService` · 4 callsites
  - `setupExportService` · 2 callsites
  - `setupSubmissionService` · 3 callsites
  - Total: 11 callsites, todos dentro de funções já `async`
- **Warm-up no `mounted` do SetupPage**: dispara o download de
  `vendor-supabase` em paralelo com o usuário começar a digitar. Se
  o autosave do rascunho disparar logo depois, o módulo já está em
  cache (latência percebida ~0 ms).
- **`vite.config.ts` documentado** explicando os 3 chunks lazy
  (`excelExportService`, `vendor-xlsx`, `vendor-supabase`).

## Parcialmente implementado

- Nenhum item parcial.

## Não implementado

- **Bootstrap CSS subset (30,69 KB gzip eager)**: a constituição do
  projeto fixa Bootstrap 5 — off-limits.
- **Code-split do `vendor-vue-router`** (10,09 KB gzip): poderia ser
  lazy se a app tivesse rotas dinâmicas. O projeto tem só `/` →
  SetupPage, sem rotas filhas. Ganho marginal, esforço alto.
- **Code-split do core Vuex** (4,02 KB gzip): Vuex é necessário desde
  o boot para hidratar state. Não há como tornar lazy sem refazer
  arquitetura de estado.

## Correções importantes aplicadas

- O `console.warn` do modo local-only agora dispara **uma vez** (flag
  `_warnedOnce`) em vez de a cada chamada de `getSupabase()`. Era
  bug latente da v5.4: em modo sem env, qualquer save/load logava
  warning duplicado.

## Regressões evitadas

- API pública dos 4 services preservada: assinaturas externas
  (`recordAudit`, `saveDraft`, `loadDraft`, etc) continuam idênticas.
- `SUPABASE_CONFIGURED`, `APP_ENV`, `APP_NAME` continuam síncronos —
  qualquer código que dependa de checar configuração no boot (ex.:
  componente que esconde botão "Persistir") continua funcionando.
- Smoke pipeline 32/32 OK — exemplo end-to-end com exportTechnicalWorkbook
  continua passando.
- Smoke contraste 42/42 OK — nenhum CSS mexido.
- Backend .NET skeleton intacto.
- Vuex store e modelos intactos.

## Validações realizadas

- `npm install`: OK
- `vue-tsc --noEmit`: 0 erros TS (assinatura `Promise<SupabaseClient | null>`
  bate em todos os call sites)
- `vite build`: OK em 6,02s
- `smoke-pipeline.ts`: 32 OK / 0 FAIL
- `smoke-contrast.ts`: 42 OK / 0 FAIL
- `smoke:all`: encadeado OK
- Inspeção `dist/index.html`: `vendor-supabase` ausente do modulepreload
- Análise de assinatura: 11/11 callsites dentro de funções `async`,
  zero `await` em escopo não-async
- Verificação final: `grep -rn "getSupabase[^A]"` em services/ retorna 0

## Bloqueios reais

### Bloqueios técnicos
- Nenhum.

### Bloqueios por ambiente
- Validação visual real (medir DevTools Network: 1º save dispara
  `vendor-supabase` download de fato, latência real percebida) precisa
  ser feita pelo Thiago — sandbox sem display gráfico.

### Bloqueios por dependência externa
- Nenhum.

### Bloqueios por credenciais
- Deploy Netlify precisa de `git push` em `main`.

## Pendências que exigem ação manual

1. Aplicar o patch (8 arquivos)
2. `npm install` (sem novas deps, só lockfile pode regenerar)
3. `npm run smoke:all` → 32+42 OK
4. **(Recomendado)** Validar visualmente no Chrome DevTools:
   - Reload na Etapa 1 — confirmar que `vendor-supabase-*.js` **não**
     aparece nos primeiros chunks baixados (lista do modulepreload).
   - Logo após o load, o `vendor-supabase` deve começar a baixar em
     background (Network tab — pelo warm-up do `mounted`).
   - Editar um campo na Etapa 1 → aguardar autosave → download deve
     já estar concluído, save instantâneo.
5. `git commit` + push em `main`

## Como validar localmente

```bash
cd frontend
npm install
npm run build
# Esperar no output:
#   dist/assets/index-*.js              ~99 kB  │ gzip:  ~28 kB
#   dist/assets/vendor-supabase-*.js   ~204 kB  │ gzip:  ~54 kB  (lazy)
#   dist/assets/vendor-misc-*.js         ~6 kB  │ gzip:   ~2 kB  (lazy)
#   dist/assets/excelExportService-*.js ~28 kB  │ gzip:   ~8 kB  (lazy)
#   dist/assets/vendor-xlsx-*.js       ~628 kB  │ gzip: ~323 kB  (lazy)

npm run smoke:all   # 32 OK + 42 OK

# Conferir modulepreload reduzido a 3 entradas:
grep -c modulepreload dist/index.html
# Saída esperada: 3
```

## Como publicar no Netlify

Sem mudança no `netlify.toml`. Push em `main` → deploy automático.

Recomendação: medir Lighthouse score antes e depois. Estimativa:
**TTI cai ~250ms em 4G simulado** (54 KB gzip × overhead de parse +
descompressão). LCP idem.

## Como configurar Supabase

Sem mudança neste ciclo. As env vars continuam exatamente como antes:

```
VITE_SUPABASE_URL=https://yglcnirbnbwjqpvalqif.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_APP_ENV=preview
VITE_APP_NAME=Implantacao Consulte GEO
```

Se as vars estiverem ausentes, o protótipo continua operando em modo
local-only via localStorage, exatamente como antes.

## Como migrar futuramente para .NET 8 + SQL Server

Sem impacto. Code-split é apenas runtime do frontend.

Quando o backend oficial entrar, a substituição é fazer
`services/supabaseClient.ts` virar `services/apiClient.ts` apontando
para os endpoints `/api/implantacao-estrutura/*`. O padrão de lazy
loader (memoizar Promise) continua útil caso a lib de HTTP escolhida
seja pesada (Axios, GraphQL client, etc).

## Próximo ciclo recomendado

1. **Auditoria mobile <760px** das Etapas 3 (tabela com chips) e 5
   (peças bulk add) — última pendência conhecida do projeto que não
   exige browser real para começar (análise estática + propostas
   pode ser feita; validação final precisa de viewport simulator).
2. **Playwright + axe-core num pre-push hook** — complementa o smoke
   matemático cobrindo foco/teclado/aria-labels. Requer ambiente com
   Chromium (não disponível nesta sandbox).
3. **Lighthouse score baseline** — medir TTI/LCP/CLS antes e depois
   da v5.18 e documentar como referência para regressões futuras.
4. **Considerar prefetch hint** (`<link rel="prefetch">`) para
   `vendor-supabase` no `index.html` se métricas mostrarem que o
   warm-up no `mounted` é tardio demais.
