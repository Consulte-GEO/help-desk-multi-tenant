# Acessibilidade · Implantação Consulte GEO

Política e contratos técnicos de acessibilidade do protótipo.

## Critério oficial

**WCAG 2.1 nível AA**, com algumas regras seguidas em nível AAA quando
sem custo (ex.: `prefers-reduced-motion`, alvos de toque ≥40px em
desktop).

## Gate de build

O script **`smoke-contrast.ts`** trava regressões de contraste. Roda
em <100ms (TypeScript puro, sem browser) e cobre 89 pares fg/bg de
componentes reais nos dois temas. Falha → o build não declara verde.

```bash
cd frontend
npx tsx smoke-contrast.ts
```

Resultado esperado: `89 OK, 0 FAIL`.

Se uma cor for alterada no `design-system.css`, é **obrigatório**
atualizar os tokens no topo do `smoke-contrast.ts` (a duplicação é
intencional — força revisão consciente).

## Regras visuais aplicadas

### Contraste

| Texto / elemento | Mínimo WCAG | Como medimos |
|---|---|---|
| Texto corpo (≥14px regular ou ≥12px bold) | 4,5:1 | smoke-contrast |
| Texto grande (≥18pt ou ≥14pt bold) | 3,0:1 | smoke-contrast |
| **Componentes UI** (bordas, ícones, estados) | 3,0:1 | smoke-contrast com `minRatio: 3.0` |
| Estados de foco visíveis | 3,0:1 contra adjacente | `:focus-visible` com outline + offset |

### Foco visível

Toda interação por teclado precisa de foco óbvio. Usamos **anel duplo**:

```css
:focus-visible {
  outline: 2px solid var(--fg);   /* alto contraste universal */
  outline-offset: 2px;
  box-shadow: var(--focus);       /* anel magenta de branding */
}
```

- Em sidebar/CTAs com fundo escuro, o outline vira branco.
- O `outline-offset: 2px` impede sobreposição visual do anel ao botão.
- `var(--focus)` é magenta com opacidade 22% (light) / 42% (dark).

### Movimento reduzido

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.001ms !important;
    animation-duration: 0.001ms !important;
  }
}
```

### Modo preto e branco (impressão / "Salvar como PDF")

```css
@media print { ... }
```

Comportamento:

1. Sidebar, topbar, footer sticky, drawer, modais e botões somem.
2. Cores brand viram preto sobre branco.
3. Gradients, sombras e backdrop-filter removidos.
4. Floor cards mantêm borda esquerda preta como pista de tipo.
5. Cards têm `page-break-inside: avoid`.
6. Links externos recebem URL anexada via `::after`.

Resultado: imprime em qualquer impressora B&W (ou "Salvar como PDF" do
navegador) sem desperdiçar tinta colorida.

### Windows High Contrast Mode (forced-colors)

```css
@media (forced-colors: active) { ... }
```

Quando o usuário ativa High Contrast no Windows (Edge/Chromium/Firefox),
nosso CSS:

- Usa `ButtonText`/`ButtonFace` para botões (SO substitui pelo tema).
- Usa `CanvasText`/`Canvas` para texto e cards.
- Usa `Highlight` para foco e seleção (radio ativo, step ativo).
- Usa `GrayText` para `[disabled]`.
- Floor cards perdem cor (diferenciação por borda CanvasText + texto).

Sem essas regras, botões e badges ficariam invisíveis em High Contrast.

### Screen readers

Classe utility `.sr-only` disponível para texto presente no DOM mas
oculto visualmente:

```html
<button class="btn ghost" aria-label="Remover linha">
  <svg>...</svg>
  <span class="sr-only">Remover linha 3</span>
</button>
```

## O que ainda NÃO é coberto

Pendências conhecidas para próximos ciclos:

- **axe-core / Playwright** — auditoria DOM real (aria roles, landmarks,
  ordem de leitura, modais com foco preso). O `smoke-contrast` cobre só
  matemática de contraste.
- **Alvo de toque mobile <44px** — `.btn.sm` em tabelas tem 32px. AA não
  exige; AAA sim. Aceitável dado contexto desktop-first do produto.
- **Tradução / locale screen reader** — `lang="pt-BR"` no `<html>` já,
  mas alguns SVGs decorativos sem `aria-hidden`.
- **Live regions** — toasts de "Rascunho salvo" não são `aria-live`.

## Como reproduzir o teste de impressão

1. `npm run dev` ou abrir o site publicado.
2. Ctrl+P (ou Cmd+P).
3. Confirmar:
   - Sidebar/topbar/footer sumiram.
   - Cards têm borda fina cinza.
   - JSON viewer está preto sobre branco com borda.
   - Floor cards têm borda esquerda preta (não colorida).
   - Status flow listado em coluna.
4. Imprimir em impressora B&W ou salvar como PDF.

## Como reproduzir o teste de Windows HC

1. Windows: Configurações → Acessibilidade → Temas de contraste → ativar.
2. Edge: abrir o site.
3. Confirmar:
   - Botões com bordas pretas/brancas conforme tema.
   - Estados ativos (radio-pill, step-link) com outline Highlight.
   - Foco com outline Highlight contínuo.
   - Floor cards distinguíveis por borda esquerda, não por cor.
