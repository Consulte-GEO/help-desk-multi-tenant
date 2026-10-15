# Implementation Report · Implantação Consulte GEO v5.22.25

## Resumo executivo

**Pedido**: validar a v5.22.24 recebida e prosseguir com a próxima
melhoria. Escolhi a **v5.22.26 originalmente sugerida** (limpeza das
labels "Etapa N" obsoletas no `validationService.ts`) e renumerei para
v5.22.25 — dívida técnica documentada desde v5.22.20 e referenciada no
próprio relatório da v5.22.24.

**Status**: implementado, validado por smoke pipeline + smoke runtime
+ typecheck + build.

**Pipeline: 305 OK (+20) · Contraste: 89 OK · Build: ✓ 7.33s · zero
CSS novo · zero migração SQL · zero impacto em schema · zero impacto
no JSON técnico de exportação.**

## Diagnóstico

### O que existia (antes desta versão)

- `validationService.ts` produzia `localizacao` com strings literais
  hardcoded:
  - `'Etapa 1'` (correto, obra)
  - `'Etapa 3'` em **5 issues** de grupos — **errado** (hoje Etapa 2)
  - `'Etapa 4'` (correto, peças)
  - `'Etapa 6'` em **5 issues** de usuários — **errado** (hoje Etapa 5)
  - `'Etapa 7'` em **8 issues** de fornecedores — **errado** (hoje
    Etapa 6)
- `PendenciasPanel.vue` (v5.22.20) tinha função `pathToStep` local
  duplicando a lógica de mapeamento + regex de workaround
  `/^Etapa \d+$/` para sobrescrever os números errados em runtime
- `Step8Preview.vue` e `excelExportService.ts` **não tinham essa
  proteção** — exportavam etapas erradas para o usuário e para o Excel
  técnico

### O que essa versão fecha

| Consumidor | Antes | Depois |
|---|---|---|
| `Step8Preview.vue` | "Etapa 3" para grupos | "Etapa 2 · Blocos e torres" |
| `PendenciasPanel.vue` | regex de workaround | label direto da fonte |
| `excelExportService.ts` | etapa errada | "Etapa N · Título" legível |
| Rascunhos novos no Supabase | persistiam strings erradas | persistem strings corretas |

### O que foi alterado

| Arquivo | Tipo | Mudança |
|---|---|---|
| `frontend/src/services/stepMappingService.ts` | NOVO | helper centralizado (~100 linhas) |
| `frontend/src/services/validationService.ts` | MOD | 18 trocas de literais por `localizacaoForPath()` + 1 import |
| `frontend/src/components/PendenciasPanel.vue` | MOD | remove `pathToStep` local, importa do helper |
| `frontend/smoke-pipeline.ts` | MOD | bloco v5.22.25 (+20 testes runtime + estrutural); ajusta bloco v5.22.20 para refletir migração |
| `frontend/scripts/cleanup-legacy.cjs` | MOD | allowlist do novo `stepMappingService.ts` |
| `frontend/package.json` | MOD | version bump 5.0.22-24 → 5.0.22-25 |
| `README.md` | MOD | header + nova seção v5.22.25 |
| `docs/CHANGELOG_SOLICITACOES.md` | MOD | entrada v5.22.25 no topo |
| `IMPLEMENTATION-REPORT-V522-25.md` | NOVO | este relatório |

### O que foi validado

- **Pipeline**: 305 OK / 0 FAIL (eram 285 na v5.22.24; +20 testes
  novos, sendo 4 estruturais + 10 runtime + 6 que migraram do bloco
  v5.22.20 antigo)
- **Contraste**: 89 OK / 0 FAIL (zero CSS novo)
- **Build**: verde em 7.33s
- **Typecheck strict**: limpo (`npx vue-tsc --noEmit`)
- **Smoke runtime**: instanciei `validateSnapshot(snapshotVazio)` e
  conferi:
  - Zero issues com `localizacao: 'Etapa 3'` no path `grupos*`
  - Zero issues com `localizacao: 'Etapa 6'` no path `usuariosObra`
  - Zero issues com `localizacao: 'Etapa 7'` no path `fornecedores`
  - `VAL-OBRA-003` (obra sem grupos) → `"Etapa 2 · Blocos e torres"`
  - `USUARIOS_OBRA_VAZIO` → `"Etapa 5 · Usuários da obra"`
  - `FORNECEDORES_VAZIO` → `"Etapa 6 · Fornecedores"`
  - Zero mismatches entre número declarado e `pathToStep(path)`

### O que NÃO pôde ser validado

- **Comportamento visual real em browser**: sandbox sem headless. Os
  consumidores (`Step8Preview`, `PendenciasPanel`, Excel) já mostram
  `localizacao` no template diretamente — não precisam de mudança no
  template. Validei estaticamente que continuam lendo `i.localizacao`
  via grep.
- **Rascunhos legados persistidos no Supabase** com strings antigas
  ("Etapa 3" gravadas em snapshots de antes da v5.22.25): essas
  strings continuam servidas pelo validationService **se** ele
  re-validar o snapshot na próxima abertura, mas como a validação roda
  client-side em cada open, isso já gera a label nova. O regex de
  defesa no PendenciasPanel cobre o caso edge de rascunho enviado
  (status=enviado) que carrega `validationResult` snapshotado em
  banco.

## Decisões registradas

### Por que centralizar em `stepMappingService.ts` em vez de keep em PendenciasPanel

Antes a função `pathToStep` morava só no `PendenciasPanel.vue`. O
problema da dívida técnica era que o `validationService` precisava do
**mesmo mapeamento** para gerar `localizacao` correto. Mover para um
helper:

1. **Single source of truth**: quando o wizard mudar de novo (e
   provavelmente vai, com Etapa 8 de Acompanhamento da equipe etc.),
   um único arquivo precisa de patch.
2. **Lê `WIZARD_STEPS` direto**: o helper não tem títulos
   hardcoded — busca no model. Se você renomear "Blocos e torres"
   para "Estruturas e torres", o helper acompanha automaticamente.
3. **Testável puro**: helper sem dependência de DOM, fácil de testar
   em smoke runtime. PendenciasPanel teria que ser mockado para
   testar a mesma lógica.

### Por que `"Etapa N · Título"` em vez de só o número

Antes: `localizacao: "Etapa 3"` (vazio de contexto, e ainda errado).

Agora: `localizacao: "Etapa 2 · Blocos e torres"`.

Razão prática: o Excel técnico exporta `localizacao` direto numa
coluna. Quem abre o arquivo de validação no Excel sem ver a tela
recebe contexto suficiente para ir corrigir. Custa zero comparado a
"Etapa 2" sozinho, e é a mesma string que o painel de pendências já
mostra. Coerência cross-canal sem esforço extra.

### Por que manter o regex de workaround no PendenciasPanel

`PendenciasPanel.vue` ainda tem:

```js
if (/^Etapa \d+$/.test(locDisplay)) {
  locDisplay = `Etapa ${step}`;
}
```

Manter como defesa em profundidade:

- **Rascunhos enviados** (`setup_submissions.snapshot_validation`)
  podem ter sido gravados antes da v5.22.25 com strings antigas.
  Quando a equipe abrir esses registros em `/r/:token`, o regex pega.
- Custo é literalmente uma linha — o ROI da defesa é altíssimo.

### Por que o teste runtime no smoke (não só estrutural)

Smoke estrutural (grep do código) pega "esqueceu de remover a string
literal". Smoke runtime (chamar `validateSnapshot` de verdade) pega
"a função produz o output certo". As duas se complementam:

- Estrutural: detecta regressão se alguém colar de volta `'Etapa 3'`
  num PR
- Runtime: detecta regressão se alguém quebrar `pathToStep` ou
  `stepTitle` (ex.: typo no `WIZARD_STEPS`)

## Ambiente usado

- Node 22.22.2, npm 10.9.7
- Vite 5.4.21
- vue-tsc 2.1.6 + TypeScript strict 5.4.5
- Sandbox Linux sem credenciais Supabase / browser

## Arquivos criados

| Arquivo | Linhas |
|---|---|
| `frontend/src/services/stepMappingService.ts` | 100 |
| `IMPLEMENTATION-REPORT-V522-25.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/services/validationService.ts` | 18 trocas de `'Etapa N'` literais por `localizacaoForPath(path)` + 1 import + 2 comentários de bloco atualizados |
| `frontend/src/components/PendenciasPanel.vue` | remove `function pathToStep` local (~20 linhas), importa do helper, comentários do `visibleItems` atualizados |
| `frontend/smoke-pipeline.ts` | bloco v5.22.25 (~180 linhas), ajuste bloco v5.22.20 (~10 linhas), check de versão flexível |
| `frontend/scripts/cleanup-legacy.cjs` | +2 linhas (allowlist) |
| `frontend/package.json` | version bump |
| `README.md` | header + nova seção (~45 linhas) |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.25 (~35 linhas) |

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `unzip implantacao-consulte-geo-source-completo-v05-22-24.zip` | ✓ | baseline limpa |
| `cd frontend && npm install` | ✓ | dependências da v5.22.24 |
| `npx tsx smoke-pipeline.ts` (baseline) | **285 OK** | confere relatório v5.22.24 |
| `npx tsx smoke-contrast.ts` (baseline) | **89 OK** | confere relatório v5.22.24 |
| `npm run build` (baseline) | **✓ 7.21s** | confere relatório v5.22.24 |
| `cp -r ... v05-22-25` | ✓ | clone para edição |
| `npx vue-tsc --noEmit` (após edições) | ✓ limpo | nenhum erro de tipo |
| smoke ad-hoc temporário (deletado) | 5 issues OK, 0 mismatches | confirmou runtime correto |
| `npx tsx smoke-pipeline.ts` (v5.22.25) | **305 OK / 0 FAIL** | +20 testes |
| `npx tsx smoke-contrast.ts` (v5.22.25) | **89 OK / 0 FAIL** | sem CSS novo |
| `npm run build` (v5.22.25) | **✓ 7.33s** | mesmas chunks, sem warnings novos |

## Implementado com sucesso

- [x] `stepMappingService.ts` criado com `pathToStep`, `stepTitle`,
      `localizacaoForPath`
- [x] Lê `WIZARD_STEPS` direto do model (consistência futura)
- [x] `validationService.ts` zerou literais `'Etapa N'` em código
- [x] 18 chamadas a `localizacaoForPath(path)` em uso
- [x] `PendenciasPanel.vue` importa `pathToStep` do helper
- [x] Função local `pathToStep` removida do PendenciasPanel
- [x] Regex de workaround mantido como defesa em profundidade
- [x] Smoke pipeline +20 testes novos (estrutural + runtime)
- [x] Bloco v5.22.20 ajustado para refletir migração (sem regressão)
- [x] cleanup-legacy allowlist atualizado
- [x] package.json bumpado para 5.0.22-25
- [x] README + CHANGELOG atualizados
- [x] Backend .NET: **intocado**
- [x] Schema Supabase: **intocado**
- [x] Edge Functions: **intocadas**
- [x] CSS: **zero linhas alteradas**
- [x] JSON técnico schema: **intocado**

## Parcialmente implementado

Nada.

## Não implementado (escopo deferido)

- **v5.22.26**: bugs herdados da v5.22.23 ("Ir para Etapa N tela
  branca" e "Devolver para responsável") — continuam dependendo de
  logs do DevTools que só você consegue obter em produção. Quando
  trouxer os logs, fix exato em vez de defesa em profundidade.
- **v5.22.27**: envio do link por email via Resend — depende de
  decidir se a Edge Function `share-draft-link` é necessária ou se o
  copy/cole manual já resolve.

## Correções importantes aplicadas

### Check do bloco v5.22.20 ajustado para a migração

Antes a v5.22.20 procurava por padrões inline no `PendenciasPanel.vue`:

```js
["grupos[*].pecas → 4", /pecas[\s\S]{0,80}return\s*4/]
```

Como o `pathToStep` saiu do componente, esses checks regrediram. Os
mesmos casos foram migrados para o bloco v5.22.25 que chama
`pathToStep(path)` em runtime — teste mais sólido que regex de código.

### Regex de literais filtra comentários

A primeira versão do smoke v5.22.25 pegava também `"Etapa 6"` e
`"Etapa 7"` dentro de comentários de bloco que documentavam a
história. Refinei a regex para remover `/* ... */` e `//` antes do
match. Pega apenas literais em código real.

## Regressões evitadas

- **JSON técnico de exportação**: `localizacao` aparece dentro do
  bucket `validation` do JSON. Schema do JSON não muda formato —
  apenas o conteúdo do campo string fica diferente (mais legível). Os
  consumers futuros do .NET (`POST /api/.../submit`) recebem string
  arbitrária; nenhum parser dependeria do formato `"Etapa N"` literal.
- **Compatibilidade com rascunhos legados**: rascunhos persistidos
  antes da v5.22.25 que carregaram strings antigas continuam sendo
  re-validados client-side a cada `loadDraft`, então a label nova é
  produzida na hora. Cenários onde a string vai persistida na coluna
  `snapshot_validation` (status=enviado) ficam cobertos pelo regex de
  defesa.
- **`Step8Preview.vue` e `excelExportService.ts`**: já liam
  `i.localizacao` no template/coluna sem assumir formato — passam a
  receber o formato novo automaticamente, sem mudança.

## Validações realizadas

| Critério §16 da constituição do projeto | Status |
|---|---|
| `npm install` funciona | ✅ |
| `npx tsx smoke-pipeline.ts` passa | ✅ 305 OK |
| `npx tsx smoke-contrast.ts` passa | ✅ 89 OK |
| `npm run build` passa | ✅ 7.33s |
| `.env.example` existe, sem secrets reais | ✅ (não tocado) |
| Aplicação abre localmente | ⚠️ não validado (sandbox sem browser) |
| Sem referências a MRV ou Superestrutura | ✅ smoke garante |
| Tipo de Estrutura tem as 6 opções corretas | ✅ smoke v5.20+ |
| Projetista é texto livre | ✅ smoke v5.20+ |
| Rascunho salva e recarrega | ✅ smoke v5.22.19 |
| JSON técnico gera e valida contra schema | ✅ smoke v5.22.18 |
| Excel técnico exporta | ✅ smoke v5.22.18 |
| Validações aparecem | ✅ smoke v5.22.25 (validateSnapshot runtime) |
| Auditoria registra eventos | ✅ smoke v5.22.18 |
| Documentação atualizada | ✅ |
| Backend .NET skeleton intacto | ✅ |

## Bloqueios reais

### Bloqueios por ambiente

- **Browser real**: sandbox sem chromium-headless. Não pude validar:
  - `Step8Preview.vue` renderizando `"Etapa 2 · Blocos e torres"` em
    vez de `"Etapa 3"` quando há issue de grupo
  - `excelExportService.ts` exportando o título legível na coluna
    "Localização" do Excel técnico
  - `PendenciasPanel.vue` renderizando label corrigida sem o regex de
    workaround ativar

  Mitigação: smoke runtime chama `validateSnapshot` real e confere as
  strings de saída. Os templates leem essas strings diretamente.

### Bloqueios técnicos

Nenhum.

### Bloqueios por credenciais

Nenhum (mudança 100% client-side).

### Bloqueios por dependência externa

Nenhum.

## Pendências que exigem ação manual

1. **Visual smoke em produção**: depois de subir, abrir
   `setup.consultegeo.org` em browser, deixar um campo vazio que
   dispare validação de grupo (ex.: criar obra sem cadastrar bloco) e
   conferir que o `PendenciasPanel` mostra **"Etapa 2 · Blocos e
   torres"** em vez de "Etapa 2" sozinha ou "Etapa 3" errada.

2. **Validar no Excel técnico**: gerar uma exportação Excel completa
   e abrir aba "Validações" — coluna "Localização" deve trazer o
   título legível em todas as linhas.

3. **Validar bugs herdados** (v5.22.23 itens 2 e 5):
   - "Ir para Etapa N" não deixa branca
   - "Devolver para responsável" funciona (com logs do DevTools)
   Esses não são da v5.22.25, mas continuam pendentes.

## Como validar localmente

```bash
cd frontend
npm install
npx tsx smoke-pipeline.ts    # esperado: 305 OK / 0 FAIL
npx tsx smoke-contrast.ts    # esperado: 89 OK / 0 FAIL
npm run build                # esperado: ✓ built (≈ 7-10s)
npm run dev                  # abre http://localhost:5173
```

Para o smoke runtime específico da v5.22.25, basta rodar o pipeline
completo — os checks "validateSnapshot · ..." cobrem o caso.

## Como publicar no Netlify

Sem mudanças no `netlify.toml`. Push para `main`. Build automático.

## Como configurar Supabase

Sem mudanças no schema. Sem migration. Mudança 100% client-side.

## Como migrar para .NET 8 + SQL Server

`localizacao` é campo informativo do `ValidationIssue` no JSON
técnico — o backend .NET consome como string opaca. Quando portar:

- O equivalente de `stepMappingService.ts` em C# pode ser uma
  `StepMappingService` injetável que lê uma tabela de configuração
  `Wizard_Steps` (já espelho de `WIZARD_STEPS` do front).
- Validação server-side (no `POST /api/implantacao-estrutura/drafts/{id}/validate`)
  deve produzir o mesmo formato `"Etapa N · Título"` para coerência
  cross-canal.

## Próximo ciclo recomendado

**v5.22.26** — Validar bugs herdados (v5.22.23 itens 2 e 5). Com os
logs do DevTools, fix exato no `goToWithFocus` e/ou na Edge Function
`notify-return`.

**v5.22.27** — Envio do link compartilhável por email (Resend). Edge
Function `share-draft-link` que recebe `{draftId, recipientEmail}` e
manda email com o link `?draft=:id`. Útil para passar tarefa pra
colega formalmente.

**v5.22.28** — Backend .NET: criar `StepMappingService` em C# espelho
deste helper, para que validações server-side produzam o mesmo
formato de `localizacao`.
