# Implementation Report · Implantação Consulte GEO v5.16

## Resumo executivo

Otimização de performance: code-split do `excelExportService.ts` (52 KB raw)
para fora do bundle inicial via dynamic import nas actions Vuex e no
warm-up do SetupPage. Resultado: **first-load JS cai 6,75 KB gzip
(~19% do main chunk)**, sem alteração de UX nem de lógica.

Mudança puramente arquitetural — 3 arquivos tocados, nenhum comportamento
mudou, smoke 32/32, build limpo.

Continua respeitando o contrato do projeto: stack fechada (Vue 3 + Vite +
Vuex + Bootstrap 5), nenhuma dependência nova, backend .NET skeleton
intacto.

## Ambiente usado

- Node 20
- Vue 3.4.38 + Vite 5.4.6 + TS 5.4.5 + Vuex 4.1 + Bootstrap 5.3.3
- Apenas Linux container (sem ambiente real Netlify/Supabase)

## Arquivos criados

- `IMPLEMENTATION-REPORT-V516.md` (este arquivo)

## Arquivos alterados

- `frontend/src/store/modules/export.ts`
  (16 linhas alteradas — 1 import removido, 14 adicionadas para lazy loader)
- `frontend/src/views/SetupPage.vue`
  (5 linhas alteradas — import estático removido, watcher usa dynamic import)
- `frontend/vite.config.ts`
  (comentário atualizado refletindo o novo chunk lazy)
- `frontend/package.json` (version 5.0.15 → 5.0.16)

## Arquivos removidos

- Nenhum.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm install` | OK | Reaproveitando lock da v5.15 |
| `npm run build` (v5.16) | OK | 6.72s · 0 erros TS · CSS inalterado |
| `npx tsx smoke-pipeline.ts` | **32 OK / 0 FAIL** | Lógica de export Excel intacta |
| `grep modulepreload dist/index.html` | OK | excelExportService NÃO está no preload |

## Resultado dos comandos

### Comparativo de chunks: v5.15 → v5.16

| Chunk | v5.15 | v5.16 | Delta gzip | Quando carrega |
|---|---|---|---|---|
| `index-*.js` | 125.20 KB / **34.68 KB gzip** | 98.61 KB / **27.93 KB gzip** | **−6.75 KB** | eager (first-load) |
| `excelExportService-*.js` | (no index) | 27.57 KB / **7.78 KB gzip** | +7.78 KB | lazy (Etapa 6+) |
| `vendor-xlsx-*.js` | 627.75 KB / 323.14 KB gzip | 627.75 KB / 323.14 KB gzip | 0 | lazy (Etapa 6+) |
| `vendor-supabase-*.js` | 201.38 KB / 52.74 KB gzip | igual | 0 | eager |
| `vendor-vue-*.js` | 67.42 KB / 26.74 KB gzip | igual | 0 | eager |
| `vendor-vue-router-*.js` | 25.64 KB / 10.09 KB gzip | igual | 0 | eager |
| `vendor-vuex-*.js` | 12.14 KB / 4.02 KB gzip | igual | 0 | eager |
| `vendor-misc-*.js` | 6.03 KB / 1.84 KB gzip | igual | 0 | eager |
| **Total first-load JS gzip** | **130.11 KB** | **123.36 KB** | **−6.75 KB (−5%)** | |

CSS sem alteração: index.css 4.84 KB gzip + vendor-bootstrap.css 30.69 KB gzip.

### Verificação de modulepreload (eager)

O `dist/index.html` lista no `modulepreload` apenas:
- `vendor-vue-*.js`
- `vendor-vue-router-*.js`
- `vendor-vuex-*.js`
- `vendor-misc-*.js`
- `vendor-supabase-*.js`

Confirmado: `excelExportService-*.js` e `vendor-xlsx-*.js` ficam fora do
preload — ambos são chunks async puros.

## Implementado com sucesso

- **Code-split do excelExportService**: serviço de 1253 linhas movido
  para chunk async dedicado. -6.75 KB gzip no first-load.
- **Lazy loader memoizado no Vuex**: function `loadExcelModule()` no
  `store/modules/export.ts` segue mesmo padrão que o `loadXlsx()` interno
  do serviço (memoiza Promise, reusa nas chamadas subsequentes).
- **Warm-up preservado**: o `SetupPage.vue` continua disparando o
  download do chunk Excel quando o usuário entra na Etapa 6, via
  `import('../services/excelExportService').then(m => m.preloadXlsx())`.
  Latência de export na Etapa 7 permanece imperceptível.
- **Sem mudança de API**: nenhuma assinatura de função foi tocada. O
  smoke continua chamando `buildWorkbook(json)` direto via top-level
  import (Node/tsx faz dynamic e estático igual).

## Parcialmente implementado

- Nenhum item parcial.

## Não implementado

- **Code-split do `jsonGeneratorService`**: também é usado só nas Etapas
  6 e 7. Poderia render mais 2-3 KB gzip. Não foi feito porque introduz
  pequena latência na transição Etapa 5 → 6 (preview live). Custo/benefício
  ruim. Adiado.
- **Code-split do `vendor-supabase` (52.74 KB gzip eager)**: o cliente
  Supabase é instanciado em `services/supabaseClient.ts` que é importado
  por vários services (audit, draft, submission, export). Tirar do
  eager exige alteração em ~7 arquivos. Custo alto para um único ganho.
  Adiado.
- **Remover Bootstrap CSS (30.69 KB gzip eager)**: a constituição do
  projeto fixa Bootstrap 5 como dependência. Off-limits.

## Correções importantes aplicadas

- Comentário do `vite.config.ts` atualizado refletindo o code-split real
  (antes dizia "xlsx continua isolado automaticamente" mas o serviço
  Excel propriamente dito não era code-split).
- Memoização da Promise do lazy loader: garante que se duas actions
  Vuex forem disparadas em rápida sucessão (ex.: usuário clica
  "Exportar JSON" e "Exportar Excel" em sequência rápida), o módulo
  Excel só é carregado uma vez.

## Regressões evitadas

- Tipo `TechnicalJson` continua importado normalmente (apenas tipo,
  não vai pro bundle).
- `recordAudit` e `recordExport` continuam estáticos (são leves e usados
  pelas 3 actions — JSON, Excel, copy).
- Nenhuma classe CSS, DOM, layout ou texto alterado.
- Backend .NET skeleton intacto.
- `smoke-pipeline.ts` continua importando `buildWorkbook` estaticamente
  (em Node, dynamic vs static é transparente — só o bundle web é afetado).

## Validações realizadas

- `npm install`: OK (lock reaproveitado)
- `vue-tsc --noEmit`: 0 erros
- `vite build`: OK em 6.72s
- `smoke-pipeline.ts`: **32 OK / 0 FAIL**
- Inspeção do `dist/index.html`: `excelExportService-*.js` ausente do
  modulepreload (confirmação de que é lazy puro)
- Tamanhos dos chunks medidos antes e depois — delta confirmado

## Bloqueios reais

### Bloqueios técnicos
- Nenhum.

### Bloqueios por ambiente
- Validação em browser real (medir Lighthouse score, tempo até interactive)
  precisa ser feita pelo Thiago — container Linux sem display.

### Bloqueios por dependência externa
- Nenhum.

### Bloqueios por credenciais
- Deploy Netlify pendente de push em `main`.

## Pendências que exigem ação manual

1. **Aplicar o patch**: extrair zip, sobrepor 4 arquivos.
2. **Validar build local** (`npm run build` + `smoke-pipeline.ts`).
3. **Validar comportamento no browser** (idealmente):
   - Abrir DevTools → Network → reload na Etapa 1.
   - Confirmar que `excelExportService-*.js` **não** aparece nos chunks
     baixados.
   - Navegar até Etapa 6 — `excelExportService-*.js` e `vendor-xlsx-*.js`
     começam a baixar em background.
   - Etapa 7 → clicar "Baixar planilha" → download inicia imediato
     (chunk já em cache).
4. **Deploy Netlify**: `git push` em `main`.

## Como validar localmente

```bash
cd frontend
npm install
npm run build
# Conferir o output:
#   - index-*.js deve ser ~99 KB raw / ~28 KB gzip (era ~125 KB / 35 KB)
#   - novo excelExportService-*.js de ~28 KB / 8 KB gzip
#   - vendor-xlsx-*.js inalterado (628 KB / 323 KB gzip)
npx tsx smoke-pipeline.ts   # esperar 32 OK / 0 FAIL

# Verificar que excelExportService NÃO está em modulepreload:
grep modulepreload dist/index.html
# Saída esperada: 5 linhas (vue, vue-router, vuex, misc, supabase)
# excelExportService NÃO deve aparecer aí.

npm run dev   # http://localhost:5173 para teste visual
```

## Como publicar no Netlify

Sem mudança no `netlify.toml`. Push em `main` → deploy automático.

## Como configurar Supabase

Sem mudança neste ciclo.

## Como migrar futuramente para .NET 8 + SQL Server

Sem impacto. Bundle splitting é apenas de runtime do frontend.

## Próximo ciclo recomendado

1. **Auditoria mobile (<760px) das Etapas 3 e 5** — escopo fechado
   da auditoria v5.15 foi só desktop claro/escuro. Tabelas com muitas
   colunas (Etapa 3 com prévia expandida; Etapa 5 com bulk add) podem
   ter problemas em viewport estreito.
2. **Playwright + axe-core no smoke** — automatizar a checagem WCAG
   para impedir regressões a cada commit. Custo: ~1 dia de setup;
   benefício: travar todas as 14 métricas de contraste da v5.15.
3. **Code-split do `vendor-supabase`** — 52 KB gzip eager. Tirar exige
   refatorar 7 arquivos de service para dynamic import + uma única
   função `await getClient()`. Ganho real só vale se Lighthouse mostrar
   first-paint travado.
4. **Avaliar substituir Bootstrap CSS por subset** — o projeto usa
   apenas reset/box-sizing. 30 KB gzip eager poderia virar 2 KB com
   `bootstrap-reboot` puro. Mas o sistem prompt impõe "Bootstrap 5"
   na stack — precisa validar com o Thiago se reboot conta.
