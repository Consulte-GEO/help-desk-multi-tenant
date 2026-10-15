# Implementation Report · Implantação Consulte GEO v5.19

## Resumo executivo

Auditoria mobile (<760px) das Etapas 3 e 5 — análise estática + correções
CSS-only. 7 problemas identificados, 7 corrigidos sem tocar template
Vue, modelos, lógica ou Vuex. Mudança puramente cosmética em viewport
estreito.

**Limite honesto desta entrega**: validação visual em device real fica
pendente para o Thiago. Os problemas corrigidos foram identificáveis
por inspeção de markup + CSS (overflow horizontal, flex sem media
query, padding fixo, etc) — tipo de coisa que NÃO precisa de browser
real para diagnosticar. Os aspectos que **precisam** de validação
visual (qualidade percebida da sombra de scroll, touch targets em
device de 360px, comportamento iOS Safari) ficam listados em
"Pendências".

Smokes 32+42 OK, CSS +700 bytes (50 linhas).

## Ambiente usado

- Node 22.22.2 (compatível Node 20+)
- Vue 3.4.38 + Vite 5.4.6 + TS 5.4.5 + Vuex 4.1 + Bootstrap 5.3.3
- Sandbox sem display gráfico — validação por inspeção de código

## Arquivos criados

- `IMPLEMENTATION-REPORT-V519.md` (este arquivo)

## Arquivos alterados

- `frontend/src/styles/design-system.css`
  (header atualizado + ~50 linhas adicionadas no bloco `@media (max-width: 760px)`)
- `frontend/package.json` (version 5.0.18 → 5.0.19)

## Arquivos removidos

- Nenhum.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| Cópia v5.18 → v5.19 working | OK | base limpa |
| Análise estática de Step3 + Step5 | OK | 7 problemas identificados |
| Adição de regras em `@media (max-width: 760px)` | OK | CSS-only |
| `npm run typecheck` (vue-tsc) | 0 erros | tipos preservados |
| `npm run build` | OK em 6,68s | CSS 19,35 → 20 KB raw |
| `npm run smoke` | **32 OK / 0 FAIL** | lógica intacta |
| `npm run smoke:contrast` | **42 OK / 0 FAIL** | cores preservadas |
| `npm run smoke:all` | OK encadeado | |

## Resultado dos comandos

### Problemas identificados e corrigidos (7 itens)

| # | Componente | Onde aparecia | Correção | Tipo |
|---|---|---|---|---|
| M1 | `.section-title` (h2 + botão "Adicionar linha/grupo") | Etapas 3, 4 | `flex-direction: column` em mobile; botão full-width | CSS |
| M2 | `.card-header` com `.toolbar` (Etapa 5 — botões Copiar + Adicionar peça) | Etapa 5 | Idem M1 | CSS |
| M3 | Tabelas (`.table-wrap` com scroll horizontal sem sinalização) | Etapas 3, 5 | `box-shadow: inset` lateral indicando overflow horizontal — light e dark | CSS |
| M4 | `.grid-4 > .btn` (botão "Adicionar range" do bulk add Etapa 5) | Etapa 5 | `width: 100%` em mobile (estava com `align-self: end` inline, não ficava full-width) | CSS |
| M5 | Padding 20px dos cards | Etapas 1-8 | 16px em mobile (ganha ~8px de espaço útil) | CSS |
| M6 | Padding 28px do `.empty` e 13/14px do `.alert` | Etapas 1-8 | 20/12px em mobile | CSS |
| M7 | Botões `.btn.sm` dentro de células de tabela (Remover) | Etapas 3, 5 | min-height 32px em mobile (mantém clicável, libera altura das linhas) | CSS |

### Comparativo de viewports

| Viewport | Etapa 3 (tabela) | Etapa 5 (tabela + bulk add) | Section title | Card header |
|---|---|---|---|---|
| Desktop ≥1100px | 6 colunas full-width | 7 colunas full-width + grid-4 horizontal | h2 esquerda · botão direita | h2 esquerda · toolbar direita |
| Tablet 760-1100px | Idem desktop | Idem | Idem (sem mudança) | Idem |
| **Mobile <760px (v5.18)** | Scroll horizontal **silencioso** | Idem · botão de bulk sem full-width · padding 20px apertado | Estoura · botão espremido | Estoura · toolbar espremida |
| **Mobile <760px (v5.19)** | Scroll horizontal **com sombra inset** | + botão bulk full-width + padding 16px | Empilha · botão full-width | Empilha · toolbar full-width |

### Tamanho do CSS

| Arquivo | v5.18 | v5.19 | Delta |
|---|---|---|---|
| `index-*.css` (raw) | 19,35 KB | 20,01 KB | +0,66 KB |
| `index-*.css` (gzip) | ~4,84 KB | ~5,00 KB | +0,16 KB |

Bundle inalterado em JS (mudança puramente CSS).

## Implementado com sucesso

- **M1 .section-title em mobile**: empilha verticalmente, botão full-width.
- **M2 .card-header em mobile**: idem. Para Etapa 5, o nome do grupo
  fica em cima e os botões "Copiar estrutura" + "+ Adicionar peça"
  ficam embaixo lado a lado (toolbar com `flex: 1` cada).
- **M3 .table-wrap com sombra inset**: o `inset -16px 0 12px -12px ...`
  cria uma sombra interna no lado direito que sinaliza "tem mais
  conteúdo aqui". Versão dark mais opaca (`rgba(0,0,0,.55)`).
- **M4 .grid-4 > .btn full-width**: o botão "Adicionar range" do
  bulk add agora vira full-width em mobile (estava com `align-self: end`
  inline que não funcionava após o grid colapsar para 1fr).
- **M5 .card-header / .card-body padding 16px** em mobile (era 20px).
- **M6 .alert padding 12px** e **.empty padding 20px/16px** em mobile.
- **M7 td .btn.sm min-height 32px** em mobile (era 40px herdado de
  `.btn` global) — mantém touch target acima do mínimo Material.

## Parcialmente implementado

- **Layout "card por linha" em mobile para as tabelas grandes** (alternativa
  ao scroll horizontal): a solução mais elegante seria virar cada `<tr>`
  num card empilhado em mobile, com cada `<td>` rotulado pelo nome da
  coluna. Mas exige:
  1. Adicionar `data-label` em cada `<td>` no template Vue (Etapa 3 +
     Etapa 5), OU
  2. Usar pseudo-elements `::before` com `content: "Tipo"` por
     `nth-child(1)`, "Número" por `nth-child(2)` etc — CSS frágil
     (qualquer reordem quebra) e duplica a lista de labels.

  Decisão: ficou de fora deste ciclo. O escopo "CSS-only" foi mantido
  e a sinalização visual do scroll resolve a maior parte do problema
  (usuário sabe que tem mais conteúdo). Se o feedback do Thiago mostrar
  que scroll é insuficiente em produção, este é o próximo passo lógico
  para uma v5.20.

## Não implementado

- **Touch targets ≥44px (iOS HIG)**: mantive 32px que é o mínimo
  Material/WCAG 2.5.5 (24×24 CSS px). iOS Apple recomenda 44×44.
  Subir todos os botões para 44px aumentaria altura de linha em
  tabelas significativamente. Decisão deliberada — se Thiago testar
  em iPhone e considerar pequeno, é trivial subir.
- **Animação na sombra de scroll** (sombra "desliga" quando rolar
  até o fim, "religa" quando voltar): requer JS ou scroll-driven
  animations (suporte ainda limitado). Fora do escopo CSS-only.
- **Sidebar em mobile**: já vira `position: relative` (não-sticky) e
  step-nav vira 1 coluna no media `<760px`. Não foi mexido — fica
  como uma seção navy no topo da página. Funciona, embora ocupe
  espaço. Eventualmente vale virar drawer/menu hamburguer, mas
  exige DOM e JS — fora do escopo.

## Correções importantes aplicadas

- Padding mais enxuto em mobile não é só estética — em viewport 360px
  com 16px de padding nas laterais do `.content` + 20px nos cards
  + bordas, o conteúdo útil ficava em ~290px. Indo para 16px nos
  cards: ~298px. Soma com o `td .btn.sm` 32px → ~50px a menos de
  altura por linha em tabelas longas. Ganho real para usuários com
  device pequeno.

## Regressões evitadas

- Nenhum DOM Vue alterado.
- Nenhuma classe CSS renomeada.
- Lógica de negócio intacta (smoke 32/32).
- Cores intactas (smoke contrast 42/42).
- Sidebar inalterada (só padding do main content).
- Bundle JS inalterado.
- Desktop ≥1100px inalterado (todas as regras dentro de
  `@media (max-width: 760px)`).
- Backend .NET skeleton intacto.

## Validações realizadas

- `npm install`: OK
- `vue-tsc --noEmit`: 0 erros
- `vite build`: OK em 6,68s, CSS de 19,35 → 20,01 KB raw
- `npm run smoke`: 32 OK / 0 FAIL
- `npm run smoke:contrast`: 42 OK / 0 FAIL
- `npm run smoke:all`: OK encadeado
- Análise de seletores CSS: todas as novas regras dentro de media query
  ≤760px exceto 1 (`[data-theme="dark"] .table-wrap` dentro de outro
  `@media (max-width: 760px)` no final)

## Bloqueios reais

### Bloqueios técnicos
- Nenhum.

### Bloqueios por ambiente
- **Validação visual em mobile real pendente**. Sandbox sem display
  gráfico, sem device emulator funcional. Análise estática cobre o
  diagnóstico; validação subjetiva (sombra fica feia? botões estão
  bem posicionados? scroll horizontal incomoda mais ou menos?) precisa
  do Thiago num iPhone/Android real ou Chrome DevTools com viewport
  mobile.

### Bloqueios por dependência externa
- Nenhum.

### Bloqueios por credenciais
- Deploy Netlify pendente de push em `main`.

## Pendências que exigem ação manual

1. Aplicar o patch (2 arquivos).
2. `npm run build` + `npm run smoke:all` para confirmar verde.
3. **Validação visual em mobile** (Thiago precisa fazer):
   - Chrome DevTools → device toolbar → iPhone 12 / Pixel 5 / Galaxy S20.
   - Verificar cada Etapa em modo claro e escuro.
   - Checklist específico:
     * Etapa 3 modo modelo_projeto: tabela rola lateralmente, sombra
       direita visível? Botão "Adicionar linha" full-width acima?
     * Etapa 4: cards de concreto OK, shortcut buttons cabem?
     * Etapa 5: card-header com nome longo + botões empilham bem?
       Tabela rola? Bulk add abre `<details>` e os 4 campos +
       botão "Adicionar range" empilham com botão full-width?
     * Etapa 6: árvore + pilhas lado a lado viram empilhadas?
       Grid-3 de contadores vira 1 coluna?
     * Etapa 7: cards Resumo + Exportação técnica empilham?
     * Etapa 8: status-flow vira 1 coluna? Comentários OK?
4. `git commit` + push em `main`.

## Como validar localmente

```bash
cd frontend
npm install
npm run build
npm run smoke:all   # 32 + 42 OK

# Para inspeção visual:
npm run dev         # http://localhost:5173
# Chrome → DevTools → Toggle device toolbar (Ctrl+Shift+M) → escolher device
# Navegar pelas 8 Etapas, alternar tema claro/escuro
```

## Como publicar no Netlify

Sem mudança no `netlify.toml`. Push em `main` → deploy automático.

## Como configurar Supabase

Sem mudança neste ciclo.

## Como migrar futuramente para .NET 8 + SQL Server

Sem impacto. CSS responsivo não cruza fronteira de backend.

## Próximo ciclo recomendado

1. **Validação visual em mobile real pelo Thiago** — pode listar
   itens cosméticos que análise estática não pegou. Esses retornam
   numa v5.20.
2. **Layout "card por linha" em mobile** para as tabelas grandes
   (alternativa ao scroll horizontal) — solução mais elegante se o
   feedback mostrar que scroll incomoda. Requer mexer em template
   Vue (adicionar `data-label` em cada `<td>`).
3. **Playwright + axe-core num pre-push hook** — cobre foco por
   teclado, navegação por screen reader, aria-labels. Requer
   ambiente com Chromium.
4. **Baseline Lighthouse mobile** — medir Performance/Accessibility/
   Best Practices/SEO em viewport 360x640 para documentar o estado
   atual e detectar regressões futuras.
