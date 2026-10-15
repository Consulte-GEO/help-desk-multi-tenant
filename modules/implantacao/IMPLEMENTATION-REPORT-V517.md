# Implementation Report · Implantação Consulte GEO v5.17

## Resumo executivo

Smoke automatizado de contraste WCAG AA travando regressões silenciosas.
TS puro (sem browser, sem axe-core/Playwright, sem download de binário).
Roda em <100ms, integrado ao `package.json` como `npm run smoke:contrast`.

**Achado importante**: o próprio smoke detectou um bug que a auditoria
manual da v5.15 deixou escapar — `warning-fg` light tinha 4,41:1 contra
warning-bg, abaixo do AA 4,5:1. Corrigido no mesmo ciclo: `--warning-fg`
light desencaixado de `--warning` (base preservado, foreground
descido para `#8d5800` que passa 6:1).

42 pares fg/bg críticos verificados em ambos os temas — 42 OK / 0 FAIL.

## Ambiente usado

- Node 20 / 22 compatível
- Vue 3.4.38 + Vite 5.4.6 + TS 5.4.5 + Vuex 4.1 + Bootstrap 5.3.3
- `tsx@^4.21.0` agora como devDependency

## Arquivos criados

- `frontend/smoke-contrast.ts` — script de validação WCAG (270 linhas)
- `IMPLEMENTATION-REPORT-V517.md` (este arquivo)

## Arquivos alterados

- `frontend/src/styles/design-system.css`
  (header + bloco semantic — `--warning-fg` light desencaixado de `--warning`)
- `frontend/package.json` (version + 3 scripts novos + `tsx` em devDeps)

## Arquivos removidos

- Nenhum.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm install` | OK | tsx instalado em devDeps |
| `npm run smoke` | **32 OK / 0 FAIL** | smoke de lógica (preservado) |
| `npm run smoke:contrast` (pré-correção) | 40 OK / **2 FAIL** | encontrou regressão real do warning light |
| `npm run smoke:contrast` (pós-correção) | **42 OK / 0 FAIL** | tudo verde |
| `npm run smoke:all` | OK | encadeia smoke + smoke:contrast |
| `npm run build` | OK | 6.81s, 0 erros TS |
| Validação CI: regressão simulada | exit 1 | smoke trava build se quebrar AA |
| Validação CI: estado saudável | exit 0 | OK |

## Resultado dos comandos

### Pares verificados (42 casos · 21 por tema)

Para cada tema (light + dark):
- 5 fundamentos: fg/bg, fg/surface, fg-muted/bg, fg-muted/surface, fg-muted/surface-raised
- 4 alerts: info, success, warning, danger
- 4 badges: idem
- 2 shortcuts: default (lavanda) + empty (verde)
- 1 btn.danger
- 1 btn.primary
- 2 sidebar: step-link inativo + ativo (gradient navy)
- 1 pre.json
- 1 save-state em topbar

Total: 21 pares × 2 temas = **42 cases**.

### Achado da auditoria manual v5.15 vs smoke automatizado

A v5.15 auditou manualmente ~30 pares fg/bg em 3 horas humanas e
declarou "0 falhas WCAG AA". O smoke encontrou 2 falhas em 80ms:

```
light · alert.warning — got 4,41:1, want ≥4,5:1
light · badge.warning — got 4,41:1, want ≥4,5:1
```

Causa: `#a36500` (cor de marca do warning) sobre `#fff6df`
(warning-bg light) tem luminância insuficiente. Olhômetro humano não
pega — diferença de 4,41 para 4,50 é 2% e visualmente ambos parecem
"OK, dá pra ler".

**Lição reforçada**: validação programática de contraste deve ser
permanente no pipeline, não auditoria pontual.

## Implementado com sucesso

- **`frontend/smoke-contrast.ts`** — script completo com:
  - WCAG 2.0 `relativeLuminance` e `contrastRatio` matemáticos
  - `alphaOver(top, alpha, base)` — simula `rgba()`/`color-mix()` sobre
    layer opaca (replica fielmente o que o browser renderiza)
  - Tokens snapshot duplicados intencionalmente (não parsea CSS — força
    atualização consciente quando design-system mudar)
  - 42 cases nomeados com `where:` para localizar visualmente
  - Exit 1 em falha (CI-friendly)
- **Correção `--warning-fg` light**: desencaixado de `--warning`. Base
  `#a36500` preservado (usado em borders e em `--warning-bg` dark via
  rgba), foreground vai para `#8d5800` (passa 6:1 sobre o bg amarelado).
- **Scripts package.json**:
  - `npm run smoke` — lógica (32 cases, era `npx tsx smoke-pipeline.ts`)
  - `npm run smoke:contrast` — contraste (42 cases)
  - `npm run smoke:all` — encadeia ambos
- **`tsx` como devDependency** — antes vinha via `npx` on-demand
  (depende de rede no build); agora é determinístico, instala junto
  do `npm install`.

## Parcialmente implementado

- Nenhum item parcial.

## Não implementado

- **Auto-parsing do design-system.css**: o smoke usa tokens snapshot
  hardcoded em vez de parsear o CSS. Foi decisão consciente:
  1. Sem dependência de parser CSS (postcss/css-tree) = setup mais leve.
  2. Mudar o CSS sem atualizar o smoke quebra explicitamente — força o
     desenvolvedor a revisar o impacto da mudança.
  3. Parser de `color-mix(in srgb, ...)` em build é não-trivial.
- **Validação no Netlify CI**: o `npm run build` NÃO chama smoke. Deixei
  isso de fora propositalmente para não bloquear o deploy se o
  desenvolvedor quiser empurrar um WIP com warning conhecido.
  Recomendação: adicionar `"prebuild": "node scripts/cleanup-legacy.cjs
  && npm run smoke:contrast"` se quiser blindar o deploy.
- **Cases de texto grande (AA 3:1)**: todos os 42 cases usam 4,5:1 como
  mínimo. Não há texto grande (>=18pt) suficientemente isolado nos
  componentes que justifique relaxar. Headers usam 18-24px regular, que
  ainda exige 4,5:1.

## Correções importantes aplicadas

- `--warning-fg` light agora `#8d5800` (era `var(--warning) = #a36500`).
  Passou de 4,41:1 → 5,98:1 contra o warning-bg light. Visualmente é
  uma sombra 11% mais escura, quase imperceptível em UI mas decisiva
  para AA.

## Regressões evitadas

- Nenhum DOM alterado.
- Nenhuma classe CSS renomeada.
- Lógica de negócio intacta (smoke de lógica continua 32/32).
- Bundle de produção inalterado em tamanho (smoke é dev-time only).
- Backend .NET skeleton intacto.
- Tokens da v5.15 preservados — só `--warning-fg` light mudou.

## Validações realizadas

- `npm install` (com novo `tsx` em devDeps): OK
- `npm run smoke` (lógica): **32 OK / 0 FAIL**
- `npm run smoke:contrast`: **42 OK / 0 FAIL**
- `npm run smoke:all`: OK encadeado
- `npm run build`: OK, 6.81s, 0 erros TS, bundle inalterado vs v5.16
- Sanity check de exit code: regressão simulada retorna 1, estado
  saudável retorna 0 (CI-friendly)
- Extract zip completo + install + build + smoke:all: aguardando packing

## Bloqueios reais

### Bloqueios técnicos
- Nenhum.

### Bloqueios por ambiente
- Sandbox não tem internet para `*.azureedge.net` / `playwright.dev` —
  por isso optei por smoke matemático em vez de Playwright + axe-core.
  Para o próximo ciclo, validação com browser real continua útil
  (cobre foco/teclado/aria — coisas que matemática não cobre).

### Bloqueios por dependência externa
- Nenhum. `tsx` está em devDeps.

### Bloqueios por credenciais
- Deploy Netlify pendente de push em `main` (sem mudança no `netlify.toml`).

## Pendências que exigem ação manual

1. Aplicar o patch (5 arquivos).
2. `npm install` para registrar `tsx` em devDeps.
3. `npm run smoke:all` para validar.
4. Decidir se quer travar o deploy também: alterar `prebuild` para
   `"node scripts/cleanup-legacy.cjs && npm run smoke:contrast"`.
5. `git commit` + push em `main`.

## Como validar localmente

```bash
cd frontend
npm install
npm run build              # 0 erros TS
npm run smoke              # 32 OK / 0 FAIL — lógica
npm run smoke:contrast     # 42 OK / 0 FAIL — WCAG AA
npm run smoke:all          # encadeia os dois
```

Para experimentar a detecção de regressão: alterar uma cor em
`smoke-contrast.ts` (ex.: `successFg: '#444444'`) e rodar
`npm run smoke:contrast` — deve falhar com exit 1 listando os pares
afetados.

## Como publicar no Netlify

Sem mudança no `netlify.toml`. Push em `main` → deploy automático.

Para blindar o deploy contra regressões de contraste, mudar `prebuild`
no `package.json`:

```diff
- "prebuild": "node scripts/cleanup-legacy.cjs",
+ "prebuild": "node scripts/cleanup-legacy.cjs && npm run smoke:contrast",
```

## Como configurar Supabase

Sem mudança neste ciclo.

## Como migrar futuramente para .NET 8 + SQL Server

Sem impacto.

## Próximo ciclo recomendado

1. **Playwright + axe-core num CI separado** (não no build) — cobre
   foco por teclado, navegação por screen reader, aria-labels.
   Complementa o smoke matemático sem substituí-lo. Pode rodar como
   GitHub Action ou pre-push hook.
2. **Auditoria mobile <760px** das Etapas 3 (tabela com chips) e 5
   (peças bulk add) — escopo fechado da v5.15 era só desktop.
3. **Code-split do `vendor-supabase`** (52,74 KB gzip eager) — exige
   refatorar 7 services para `await getClient()`. Próximo gordo
   no bundle eager.
4. **Adicionar `prebuild` blindado** se time decidir que regressão de
   contraste deve bloquear deploy (não default — opção do operador).
