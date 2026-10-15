# Design System Consulte GEO — adaptação para Vue 3 + Bootstrap 5

A stack deste projeto é **Vue 3 + Vite + TypeScript + Vuex 4 + Bootstrap 5**.
O Design System Consulte GEO foi originalmente publicado em React/Tailwind
(ver `consulte-geo-ds.md` no project knowledge); aqui ele é aplicado via
**tokens CSS portáveis** sobre Bootstrap 5, preservando a identidade
visual e o vocabulário sem reintroduzir React/Tailwind.

## Arquivo principal

`frontend/src/styles/design-system.css` concentra:

- **Brand anchors fixos** (não invertem em dark mode):
  `--cg-brand-navy`, `--cg-brand-purple`, `--cg-brand-magenta` e o
  `--cg-brand-gradient`.
- **Surfaces / foreground / semantic** equivalentes a tokens OKLCH do DS v2.
- **Tipografia**: `Inter` para display/body e `JetBrains Mono` para kicker e
  blocos de código (importados via Google Fonts no `index.html`).
- **Geometry**: `--cg-radius` 16px, `--cg-shadow` suave navy, touch target
  44 px.
- **Override do Bootstrap** via custom properties (`--bs-primary`,
  `--bs-body-bg`, `--bs-border-radius`).

## Classes utilitárias deste DS

- `.cg-topbar` — header com gradiente brand
- `.cg-kicker` — kicker UPPERCASE mono 0.18em tracking
- `.cg-card` / `.cg-card-header` — card com border-radius 16px e shadow
- `.cg-table-wrap` / `.cg-table` — tabela estilizada
- `.cg-pill` + modificadores (`--ok`, `--warn`, `--bad`, `--info`,
  `--neutral`)
- `.cg-stepper` / `.cg-stepper-item` — navegação por etapas
- `.cg-tree` / `.cg-tree-card` — prévia visual em árvore
- `.cg-validation` / `.cg-validation-row` — painel de validação
- `.cg-stat` / `.cg-stats` — KPIs
- `.cg-banner` + modificadores — feedback inline
- `.cg-json` — bloco escuro para JSON técnico
- `.btn-cg-primary` / `.btn-cg-brand` / `.btn-cg-ghost` / `.btn-cg-light` —
  variantes de botão sobre `.btn` do Bootstrap

## Logos

`frontend/src/assets/logowhite.png` e `logowhite2x.png` são usados no
header (`AppShell.vue`). Os equivalentes em cor (`logocolor.png`,
`logocolor2x.png`) também estão em assets para usos futuros (favicon,
PDFs).

## A11y baseline

- `prefers-reduced-motion` zera transições.
- `.form-control:focus` recebe ring `box-shadow` 3px com 18% de opacidade
  do primary.
- Touch targets ≥ 38–44 px nos botões.

## Quando usar componentes do DS original (React/Tailwind)

Não usar. A v2 do DS está em React + Tailwind + OKLCH, o que entra em
conflito direto com as **restrições absolutas** deste projeto. Quando
houver necessidade de um componente novo (ex.: combobox real), o caminho
é compor `Input + Tag` ou implementar em Vue 3 com Bootstrap, mantendo
o vocabulário visual definido aqui.
