# Implementation Report · Implantação Consulte GEO v5.22.15

## Resumo executivo

**Pedido do Thiago**: "Revisão black/white e auditoria de acessibilidade
CSS. Identifique tudo que precisa ser atualizado no Project Knowledge.
Implemente o que for possível sem ação manual."

Auditoria detectou:

1. **4 falhas reais de contraste** em bordas `floor-card.fck-XX` que
   passavam silenciosamente porque o `smoke-contrast.ts` não testava
   essas cores (cobertura: 42 pares; faltavam ~15 componentes que
   foram adicionados nas v5.18–v5.22).
2. **Ausência de `@media print`** — imprimir o app gera lixo (sidebar
   gradient navy enorme, JSON com fundo escuro, botões inúteis).
3. **Ausência de `@media (forced-colors: active)`** — usuários no
   Windows High Contrast Mode veem botões invisíveis.
4. **Foco fraco em CTAs magenta** — `--focus` usa magenta 22% que some
   sobre `.btn.primary` (magenta no dark) e `.btn.brand` (gradient).

Todos os 4 itens foram corrigidos no CSS sem ação manual. O
`smoke-contrast.ts` foi expandido de 42 para 78 pares — agora trava
regressão em todos os componentes do design system.

**Build verde · typecheck verde · 161 smokes pipeline · 78 smokes
contraste (era 42).**

## Ambiente usado

- Node 22.x, npm 10.9.7
- Vite 5.4.21
- vue-tsc + TypeScript strict
- Sandbox Linux sem Supabase CLI / Deno / credenciais

## Diagnóstico — o que estava silencioso

### A. Cobertura faltante no smoke-contrast

Componentes adicionados em v5.18–v5.22 sem entrada correspondente no
`smoke-contrast.ts`:

| Componente | Versão de origem | Status anterior |
|---|---|---|
| `.btn.success` | v5.22.4 | Não testado |
| `.btn.nav-back` | v5.22.4 | Não testado |
| `.comment--internal` | v5.22 | Não testado |
| `.input-suffix` (em dark) | v5.15 (sobrescrita) | Não testado |
| `.brand-subtitle` (10px) | v5.10 | Não testado |
| `.kicker` (10px) | v5 | Não testado |
| `.radio-pill.active` (light + dark mix) | v5.9 | Não testado |
| `.status-step.active` | v5 | Não testado |
| `.ticket-number-block` | v5.20 | Não testado |
| `.floor-card.fck-XX` (6 cores × 2 temas) | v5 | Não testado — **4 falhas reais** |

### B. Falhas reais de contraste UI (WCAG 1.4.11 — min 3:1)

| Caso | Atual | Mínimo | Diferença |
|---|---|---|---|
| light · fck-15 (#9d8df1 sobre #f7f6f2) | 2.58:1 | 3:1 | −16% |
| dark · fck-20 (#2368a2 sobre #181e31) | 2.82:1 | 3:1 | −6% |
| dark · fck-35 (#c5117e sobre #181e31) | 2.96:1 | 3:1 | −1% |
| dark · fck-40+ (#b42318 sobre #181e31) | 2.52:1 | 3:1 | −16% |

Correção aplicada: **trocar as 6 cores fixas de borda por variáveis
`*-fg` que já existem e se adaptam por tema**. Resultado:

| Borda | Light | Dark |
|---|---|---|
| fck-15 | `--brand-purple-fg` = #3e2d71 | = #c2b3ef |
| fck-20 | `--info-fg` = #2368a2 | = #7ab8eb |
| fck-25 | `--success-fg` = #1f7a4a | = #6fcf97 |
| fck-30 | `--warning-fg` = #8d5800 | = #f0c674 |
| fck-35 | `--brand-magenta` = #c5117e | `--brand-magenta-light` = #e8459e |
| fck-40+ | `--danger-fg` = #b42318 | = #f08c80 |

Todos passam 3:1 agora (verificado pelo smoke).

### C. Foco invisível em CTAs magenta

`:focus-visible` aplicava apenas `box-shadow: var(--focus)` que é
magenta 22% (light) ou 42% (dark). Sobre `.btn.primary` em dark
(magenta puro) ou `.btn.brand` (gradient terminando em magenta), o
anel some completamente.

Correção: **anel duplo** — `outline: 2px solid var(--fg)` com
`outline-offset: 2px` (anel sólido com alto contraste universal) +
o box-shadow magenta preserva a identidade visual. Em sidebar e CTAs
escuros, o outline vira branco automaticamente.

### D. Sem suporte a impressão

Imprimir o app via Ctrl+P imprimia: sidebar gradient navy de altura
total, topbar sticky, gradient brand nos botões, JSON viewer com
fundo `#0e1b40`. Resultado: dezenas de páginas com lixo cromado e
gasto de tinta absurdo.

Correção: `@media print` completo (170 linhas de CSS):

- Esconde sidebar, topbar, footer, drawer, modais, todos os botões.
- Força preto sobre branco em todas as variáveis.
- Remove sombras, gradients, backdrop-filter.
- Cards viram filetes simples com `page-break-inside: avoid`.
- Floor cards mantêm borda esquerda preta como pista de tipo.
- Status flow vira coluna única.
- Links externos ganham URL anexada via `::after`.

### E. Sem suporte a Windows High Contrast

Usuários com Windows HC ativo viam botões e badges sem distinção
visual (cores arbitrárias eram sobrescritas pelo SO mas nosso CSS
não cooperava — borders sumiam).

Correção: `@media (forced-colors: active)` que respeita as system
colors do CSS (ButtonText, ButtonFace, CanvasText, Canvas, Highlight,
GrayText). Botões, badges, separators, foco e estados ativos agora
respondem corretamente.

## Arquivos criados

- `docs/ACESSIBILIDADE.md` — política WCAG, gate de build, instruções
  de teste manual.
- `IMPLEMENTATION-REPORT-V522-15.md` (este arquivo).

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/styles/design-system.css` | +205 linhas: `:focus-visible` reforçado, `.sr-only`, `@media print` (170 linhas), `@media (forced-colors: active)`. Floor cards FCK trocados para variáveis adaptativas. Header atualizado para v5.22.15. |
| `frontend/smoke-contrast.ts` | +118 linhas: 11 blocos de teste novos cobrindo btn.success, btn.nav-back, comment--internal, input-suffix, brand-subtitle, kicker, radio-pill.active, status-step.active, ticket-number-block, floor-card fundo + 6 bordas FCK. Header atualizado. |
| `frontend/package.json` | versão `5.22.14` → `5.22.15` |

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm install` | OK | 72 packages |
| `npx tsx smoke-contrast.ts` (antes) | 42 OK / 0 FAIL | Cobertura insuficiente |
| `npx tsx smoke-contrast.ts` (com novos pares, sem fix) | 74 OK / 4 FAIL | Detectou as 4 falhas reais |
| `npx tsx smoke-contrast.ts` (depois do fix CSS) | 78 OK / 0 FAIL | Todos os pares passam |
| `npx tsx smoke-pipeline.ts` | 161 OK / 0 FAIL | Regressão zero |
| `npm run build` | OK em 8.16s, 149 modules | CSS: 30,04 → 33,53 kB (+3,5 kB para print/forced-colors) |

## Implementado com sucesso

- [x] Cobertura smoke-contrast: 42 → 78 pares (+36 pares novos)
- [x] 4 falhas reais de contraste UI corrigidas (bordas FCK adaptativas)
- [x] Foco visível em qualquer fundo (anel duplo outline + box-shadow)
- [x] Modo preto e branco para impressão (@media print)
- [x] Suporte a Windows High Contrast (@media forced-colors)
- [x] Classe utility `.sr-only` para screen readers
- [x] Documentação técnica em `docs/ACESSIBILIDADE.md`
- [x] Build verde em produção

## Parcialmente implementado

Nenhum item.

## Não implementado (fora do escopo desta versão)

- **axe-core / Playwright** — auditoria DOM real (aria roles, landmarks,
  ordem de leitura, foco preso em modais). Demanda Playwright +
  binário de browser; não roda no smoke pipeline puro.
- **Alvo de toque mobile ≥44px AAA** — `.btn.sm` em tabelas tem 32px.
  AA não exige; manter como está. Pode ser revisado depois.
- **Live regions ARIA** — toasts de "Rascunho salvo" deveriam ter
  `aria-live="polite"`. Não toquei nos componentes Vue desta vez.
- **`aria-hidden` em SVGs decorativos** — vários ícones inline ainda
  não têm `aria-hidden="true"`.

## Correções importantes aplicadas

A correção das bordas FCK é estruturalmente melhor do que parece:
saímos de 6 cores hardcoded para 6 variáveis semânticas. Resultado
colateral positivo: se algum dia uma das cores de marca for ajustada,
os floor cards seguem o ajuste automaticamente sem precisar de
intervenção manual.

## Regressões evitadas

- O `smoke-pipeline.ts` (161 testes) continua verde.
- O typecheck Vue não acusa nada.
- O CSS cresceu apenas 3,5 kB (gzipped ~1 kB extra).
- Vendor bundle não foi tocado.

## Validações realizadas

| Validação | Resultado |
|---|---|
| `smoke-contrast.ts` (matemática WCAG 2.0) | 78 OK / 0 FAIL |
| `smoke-pipeline.ts` (regressão pipeline) | 161 OK / 0 FAIL |
| `npm run build` (Vite + vue-tsc strict) | OK 8.16s |
| Tamanho do CSS final | 33,53 kB (+3,5 kB) |
| Tamanho do bundle JS | inalterado |

## Bloqueios reais

### Bloqueios técnicos
Nenhum.

### Bloqueios por ambiente
- Não consigo testar `@media print` em renderer real (sem browser
  headless). Validação foi por inspeção do CSS gerado e checklist em
  `docs/ACESSIBILIDADE.md`. Teste manual recomendado: `Ctrl+P` no
  site publicado.
- Não consigo testar `forced-colors: active` (precisa Windows com HC
  habilitado). Validação por inspeção das regras CSS. Teste manual
  recomendado no Windows.

### Bloqueios por dependência externa
Nenhum.

### Bloqueios por credenciais
Nenhum — esta versão é 100% frontend, sem mexer em Supabase / Netlify.

## Pendências que exigem ação manual

**1. Atualizar o Project Knowledge (sistema de instruções do Claude).**

Os itens abaixo NÃO existem hoje no Project Knowledge e precisam ser
adicionados manualmente para o próximo Claude trabalhar com as
mesmas regras desta versão:

- Política WCAG 2.1 AA como gate obrigatório.
- `smoke-contrast.ts` como teste obrigatório no fluxo (ao lado do
  `smoke-pipeline.ts`).
- Tokens de cor proibidos hardcoded em componentes — usar variáveis
  CSS adaptativas.
- Regra: alterações de cor exigem atualização sincronizada do
  `smoke-contrast.ts`.
- Modo de impressão (`@media print`) como contrato do design system.
- Suporte a Windows HC (`@media (forced-colors: active)`).
- Foco visível com anel duplo (outline + box-shadow).
- Tamanho mínimo de fonte: 10px só em uppercase com tracking ≥0.10em.
- `.sr-only` disponível para texto invisível mas acessível.

Veja seção "Atualizações sugeridas para Project Knowledge" no fim
deste relatório com texto pronto para copiar.

## Como validar localmente

```bash
unzip implantacao-consulte-geo-source-completo-v05-22-15.zip
cd implantacao-consulte-geo-v05-22-15/frontend
npm install
npx tsx smoke-contrast.ts   # esperado: 78 OK / 0 FAIL
npx tsx smoke-pipeline.ts   # esperado: 161 OK / 0 FAIL
npm run build               # esperado: build verde em ~8s
npm run dev                 # abrir no navegador
```

Em seguida, testar manualmente:

1. **Modo escuro** — toggle no topbar; checar todos os componentes.
2. **Impressão (Ctrl+P)** — confirmar layout B&W limpo, sem sidebar.
3. **Windows HC** — se em Windows, ativar tema de contraste do SO e
   verificar botões/badges/foco.
4. **Foco por teclado** — Tab por toda a página; foco visível em
   todos os interativos, inclusive sobre CTA magenta da Etapa 7.

## Como publicar no Netlify

Sem mudanças necessárias. `git add -A`, commit, push → Netlify rebuilda.

## Como configurar Supabase

Sem mudanças necessárias nesta versão.

## Como migrar futuramente para .NET 8 + SQL Server

Sem impacto — esta versão é exclusivamente frontend/CSS.

## Próximo ciclo recomendado

1. **Playwright + axe-core** para validar aria roles, landmarks e foco
   preso em modais. Adicionar como gate de PR.
2. **Toasts `aria-live`** para anunciar "Rascunho salvo", "Excel
   gerado", "Validação enviada" para usuários de screen reader.
3. **Aria-hidden em SVGs decorativos** — varrer componentes Vue.
4. **Lighthouse CI** integrado ao Netlify build para tracking de
   acessibilidade score.

---

## Atualizações sugeridas para Project Knowledge

Os trechos abaixo são **texto pronto para colar** no Project Knowledge.
Recomendo inserir na seção 25 (atual "Resultado final esperado do
projeto") como nova seção 26, ou criar uma seção 8.4 dentro do
"Normalizações obrigatórias".

### Adicionar nova seção: "26. Acessibilidade obrigatória"

```markdown
26. Acessibilidade obrigatória

Critério oficial: WCAG 2.1 nível AA.

Gates de build:
- frontend/smoke-contrast.ts trava regressões de contraste (cálculo
  WCAG 2.0 em TS puro). Roda em <100ms. Falha → build não pode ser
  declarado verde.
- Toda alteração de cor no design-system.css exige atualização
  sincronizada dos tokens no topo do smoke-contrast.ts.

Regras visuais aplicadas:
- Texto corpo: contraste ≥4,5:1
- Texto grande (≥18pt ou ≥14pt bold): ≥3,0:1
- Componentes UI (bordas, ícones, estados): ≥3,0:1
- Foco visível obrigatório em todo interativo (anel duplo: outline
  + box-shadow magenta)
- Movimento reduzido honrado via prefers-reduced-motion
- Modo de impressão (@media print) força preto sobre branco e
  esconde chrome (sidebar, topbar, footer, drawer, modais)
- Windows High Contrast Mode (@media forced-colors: active)
  respeita as system colors do SO

Proibido:
- Cores hardcoded em componentes (usar variáveis CSS adaptativas
  por tema, ex.: var(--info-fg), var(--success-fg))
- Esconder foco com outline:0 sem fallback equivalente
- Texto menor que 10px (e mesmo a 10px só em uppercase com
  tracking ≥0.10em — ex.: .kicker, .brand-subtitle)
- Cores semânticas fixas para light + dark (precisam de variável)

Obrigatório quando adicionar componente novo:
1. Adicionar pares fg/bg no smoke-contrast.ts ANTES de commitar
2. Garantir :focus-visible legível em todos os fundos do componente
3. Verificar que componente sobrevive a @media print (esconder ou
   reformatar)
4. Verificar que componente sobrevive a @media (forced-colors: active)
5. Texto presente no DOM mas oculto visualmente usa class .sr-only

Documentação técnica:
- docs/ACESSIBILIDADE.md tem o detalhe completo.
```

### Atualizar seção 20 "Critérios de aceite"

Adicionar item:

```markdown
- smoke-contrast.ts passa com 0 falhas em ambos os temas
- @media print produz layout monocromático sem chrome
- @media (forced-colors: active) preserva botões/badges/foco
- Foco visível em todos os interativos, inclusive sobre CTA magenta
```

### Atualizar seção 24 "Prioridade atual"

Adicionar:

```markdown
11. Garantir que smoke-contrast.ts cobre 100% dos componentes
    fg/bg do design system
12. Garantir que toda nova cor passa contraste WCAG AA antes do
    commit
13. Garantir que toda nova superfície funciona em @media print e
    @media (forced-colors: active)
```

### Atualizar seção 21 "Restrições absolutas"

Adicionar à lista "Nunca":

```markdown
- usar cores hex hardcoded em componentes (usar variáveis CSS)
- esconder foco com outline:0 sem fallback
- adicionar componente novo sem entrada correspondente em
  smoke-contrast.ts
- usar tamanho de fonte abaixo de 10px
```
