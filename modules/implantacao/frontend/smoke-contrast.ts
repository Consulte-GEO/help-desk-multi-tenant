/**
 * Smoke de contraste WCAG · v5.22.15
 *
 * Trava regressões de contraste claro/escuro do Design System Consulte GEO.
 * Implementa o cálculo WCAG 2.0 e testa todos os pares fg/bg críticos
 * dos componentes — em ambos os temas.
 *
 * Por que TypeScript puro (e não axe-core/Playwright)?
 *   - Sem browser, sem binário pesado, sem rede.
 *   - Roda em CI/Netlify build em <100ms.
 *   - Acessibilidade visual é matemática (luminância relativa) — não
 *     precisa de renderer real para isso.
 *   - Falha cedo: se alguém alterar uma cor que cai abaixo de 4,5:1,
 *     o build trava com mensagem clara.
 *
 * Para checagens que de fato precisam de DOM (foco, leitura por teclado,
 * aria-labels), o caminho continua sendo Playwright + axe-core num
 * próximo ciclo. Este script cobre o subset que cobriu na v5.15.
 *
 * v5.22.15 — auditoria de cobertura. Adicionados pares que existiam no
 * design-system.css mas não estavam aqui (btn.success, btn.nav-back,
 * comment--internal, input-suffix, brand-subtitle, radio-pill.active,
 * status-step.active, floor-card por FCK, ticket-number-block).
 *
 * Executar com: npx tsx smoke-contrast.ts
 */

/* ------------------------------------------------------------------ */
/* WCAG 2.0 contrast math                                              */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const f = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Mistura `top` (com `alpha` em 0..1) sobre `base` opaca. Replica o
 * comportamento de `rgba(...)`/`color-mix(in srgb, top X%, base)` quando
 * o resultado é renderizado sobre uma camada opaca.
 */
function alphaOver(top: string, alpha: number, base: string): string {
  const [tr, tg, tb] = hexToRgb(top);
  const [br, bg, bb] = hexToRgb(base);
  return rgbToHex(
    tr * alpha + br * (1 - alpha),
    tg * alpha + bg * (1 - alpha),
    tb * alpha + bb * (1 - alpha),
  );
}

/* ------------------------------------------------------------------ */
/* Tokens do design-system (snapshot v5.15+)                           */
/*                                                                    */
/* Se alguém alterar uma var no design-system.css, atualizar aqui      */
/* explicitamente. A duplicação é INTENCIONAL — força revisão consciente.*/
/* ------------------------------------------------------------------ */

const LIGHT = {
  bg:                 '#f7f6f2',
  surface:            '#ffffff',
  surfaceRaised:      '#ffffff',
  fg:                 '#121a36',
  fgMuted:            '#5d5a52',  // v5.15: subido de #6d6a62
  border:             '#e7e2d8',
  borderStrong:       '#d7d0c2',
  info:               '#2368a2',
  success:            '#1f7a4a',
  warning:            '#a36500',
  danger:             '#b42318',
  infoFg:             '#2368a2',  // = info em light
  successFg:          '#1f7a4a',
  warningFg:          '#8d5800',  // v5.17: desencaixado do --warning (#a36500 falhava 4,41:1 vs warning-bg)
  dangerFg:           '#b42318',
  brandNavy:          '#182863',
  brandPurpleFg:      '#3e2d71',
  brandMagenta:       '#c5117e',
} as const;

const DARK = {
  bg:                 '#111626',
  surface:            '#181e31',
  surfaceRaised:      '#202842',
  fg:                 '#f8f7f2',
  fgMuted:            '#b6b5aa',  // v5.15
  border:             '#3a4570',  // v5.15
  borderStrong:       '#5b6a99',  // v5.15
  info:               '#2368a2',
  success:            '#1f7a4a',
  warning:            '#a36500',
  danger:             '#b42318',
  infoFg:             '#7ab8eb',  // v5.15 — foreground acessível em dark
  successFg:          '#6fcf97',
  warningFg:          '#f0c674',
  dangerFg:           '#f08c80',
  brandNavy:          '#182863',
  brandPurpleFg:      '#c2b3ef',  // v5.15
  brandMagenta:       '#c5117e',
} as const;

/* ------------------------------------------------------------------ */
/* Cases                                                               */
/* ------------------------------------------------------------------ */

interface ContrastCase {
  /** Identificação humana — aparece no log. */
  name: string;
  theme: 'light' | 'dark';
  /** Cor do foreground (após resolver vars). */
  fg: string;
  /** Cor do background efetiva (após alpha-composite, se aplicável). */
  bg: string;
  /**
   * Mínimo WCAG. Default 4.5 (texto normal AA). Use 3.0 só quando o
   * texto for grande (>=18pt ou >=14pt bold) — em UI raramente se aplica.
   */
  minRatio?: number;
  /** Descrição curta do contexto visual (onde isso aparece). */
  where?: string;
}

function makeCases(): ContrastCase[] {
  const out: ContrastCase[] = [];

  for (const theme of ['light', 'dark'] as const) {
    const T = theme === 'light' ? LIGHT : DARK;

    /* === FUNDAMENTOS === */
    out.push({
      name: `${theme} · --fg sobre --bg`,
      theme, fg: T.fg, bg: T.bg,
      where: 'texto corpo, h1/h2/h3, card-title',
    });
    out.push({
      name: `${theme} · --fg sobre --surface`,
      theme, fg: T.fg, bg: T.surface,
      where: 'texto dentro de .card',
    });
    out.push({
      name: `${theme} · --fg-muted sobre --bg`,
      theme, fg: T.fgMuted, bg: T.bg,
      where: '.kicker, .hint, .save-state',
    });
    out.push({
      name: `${theme} · --fg-muted sobre --surface`,
      theme, fg: T.fgMuted, bg: T.surface,
      where: '.card-description, .comment-meta, .padrao-section summary',
    });
    out.push({
      name: `${theme} · --fg-muted sobre --surface-raised`,
      theme, fg: T.fgMuted, bg: T.surfaceRaised,
      where: '.comment-meta (em comment com surface-raised)',
    });

    /* === ALERTS — texto semântico sobre alpha-bg sobre bg === */
    // Em dark, --info-bg etc é rgba(..,.22) sobre --bg.
    // Em light, é uma cor opaca (#ebf4ff etc) — fundo plano.
    const alertBg = (sem: string, baseLight: string) =>
      theme === 'dark' ? alphaOver(sem, 0.22, T.bg) : baseLight;

    out.push({
      name: `${theme} · alert.info — info-fg sobre info-bg`,
      theme,
      fg: T.infoFg,
      bg: alertBg(T.info, '#ebf4ff'),
      where: 'Etapa 2/6 alert info, Step6 grid-3 sugestões',
    });
    out.push({
      name: `${theme} · alert.success — success-fg sobre success-bg`,
      theme,
      fg: T.successFg,
      bg: alertBg(T.success, '#e8f7ee'),
      where: 'Etapa 7 "Pronto para enviar", Step6 grid-3 verdes',
    });
    out.push({
      name: `${theme} · alert.warning — warning-fg sobre warning-bg`,
      theme,
      fg: T.warningFg,
      bg: alertBg(T.warning, '#fff6df'),
      where: 'Step6 grid-3 alertas, Etapa 7 badge pendências',
    });
    out.push({
      name: `${theme} · alert.danger — danger-fg sobre danger-bg`,
      theme,
      fg: T.dangerFg,
      bg: alertBg(T.danger, '#fff0ee'),
      where: 'Step6 grid-3 erros, Etapa 7 "Envio bloqueado"',
    });

    /* === BADGES — mesmos pares de cores, contexto card === */
    out.push({
      name: `${theme} · badge.success`,
      theme,
      fg: T.successFg,
      bg: alertBg(T.success, '#e8f7ee'),
      where: 'badge "Completo" na árvore Etapa 6',
    });
    out.push({
      name: `${theme} · badge.warning`,
      theme,
      fg: T.warningFg,
      bg: alertBg(T.warning, '#fff6df'),
      where: 'badge "Pendente"',
    });
    out.push({
      name: `${theme} · badge.danger`,
      theme,
      fg: T.dangerFg,
      bg: alertBg(T.danger, '#fff0ee'),
      where: 'badge "Corrigir"',
    });
    out.push({
      name: `${theme} · badge.info`,
      theme,
      fg: T.infoFg,
      bg: alertBg(T.info, '#ebf4ff'),
      where: 'badge protocolo na Etapa 8',
    });

    /* === SHORTCUT BUTTONS (Etapa 4) === */
    // .btn.shortcut-default: bg = mix(brand-purple-fg 10%, surface), color = brand-purple-fg
    // .btn.shortcut-empty:   bg = mix(success-fg 12%, surface),       color = success-fg
    out.push({
      name: `${theme} · btn.shortcut-default`,
      theme,
      fg: T.brandPurpleFg,
      bg: alphaOver(T.brandPurpleFg, 0.10, T.surface),
      where: 'Etapa 4 — "+ 12 horas", "+ 7 dias", etc',
    });
    out.push({
      name: `${theme} · btn.shortcut-empty`,
      theme,
      fg: T.successFg,
      bg: alphaOver(T.successFg, 0.12, T.surface),
      where: 'Etapa 4 — "+ Vazio"',
    });

    /* === BUTTON DANGER === */
    out.push({
      name: `${theme} · btn.danger`,
      theme,
      fg: T.dangerFg,
      bg: alertBg(T.danger, '#fff0ee'),
      where: 'Remover/Limpar/× em várias etapas',
    });

    /* === BUTTON PRIMARY === */
    // Light: brand-navy #182863 + texto branco
    // Dark: brand-magenta #c5117e + texto branco
    if (theme === 'light') {
      out.push({
        name: `${theme} · btn.primary — texto branco sobre brand-navy`,
        theme, fg: '#ffffff', bg: T.brandNavy,
        where: 'CTA principal (light)',
      });
    } else {
      out.push({
        name: `${theme} · btn.primary — texto branco sobre brand-magenta`,
        theme, fg: '#ffffff', bg: T.brandMagenta,
        where: 'CTA principal (dark)',
      });
    }

    /* === SIDEBAR — texto branco sobre gradient navy === */
    // O pior caso do gradient é o navy puro (#182863). Onde o gradient
    // passa para purple/magenta o contraste só melhora (luminância sobe
    // levemente, texto branco continua dominante).
    out.push({
      name: `${theme} · sidebar step-link — branco 82% sobre navy`,
      theme,
      fg: alphaOver('#ffffff', 0.82, T.brandNavy),
      bg: T.brandNavy,
      where: '.step-link inativo',
    });
    out.push({
      name: `${theme} · sidebar step-link.active — branco sobre navy+overlay`,
      theme,
      fg: '#ffffff',
      bg: alphaOver('#ffffff', 0.18, T.brandNavy),
      where: '.step-link.active (overlay rgba(255,255,255,.18))',
    });

    /* === JSON viewer (cor fixa entre temas) === */
    out.push({
      name: `${theme} · pre.json — #eef3ff sobre #0e1b40/#07101f`,
      theme,
      fg: '#eef3ff',
      bg: theme === 'dark' ? '#07101f' : '#0e1b40',
      where: 'Etapa 7 — Visão JSON técnico',
    });

    /* === Topbar — fg-muted sobre topbar bg === */
    // Topbar usa color-mix(--bg 84% [light] / 92% [dark], transparent).
    // Atrás do topbar o que existe é a página com --bg. Como a opacidade
    // é alta (>80%), o resultado efetivo é praticamente igual a --bg.
    out.push({
      name: `${theme} · save-state em topbar`,
      theme, fg: T.fgMuted, bg: T.bg,
      where: '.save-state ("Rascunho salvo")',
    });

    /* ====================================================================
     * v5.22.15 — pares adicionados pela auditoria de cobertura.
     * ==================================================================== */

    /* === BUTTON SUCCESS (v5.22.4) === */
    // Light: bg = --success-bg (#e8f7ee), color = --success-fg (--success).
    // Dark:  bg = mix(success-fg 16%, surface), color = --success-fg.
    if (theme === 'light') {
      out.push({
        name: `${theme} · btn.success — Exportar Excel/Salvar`,
        theme,
        fg: T.successFg,
        bg: '#e8f7ee',
        where: 'Etapa 6 "Exportar Excel" / "Salvar rascunho"',
      });
    } else {
      out.push({
        name: `${theme} · btn.success — Exportar Excel/Salvar`,
        theme,
        fg: T.successFg,
        bg: alphaOver(T.successFg, 0.16, T.surface),
        where: 'Etapa 6 "Exportar Excel" / "Salvar rascunho"',
      });
    }

    /* === BUTTON NAV-BACK (v5.22.4) === */
    // Light: bg = mix(navy 8%, surface), color = navy.
    // Dark:  bg = mix(navy 24%, surface), color = #d2dcff.
    if (theme === 'light') {
      out.push({
        name: `${theme} · btn.nav-back — Voltar do wizard`,
        theme,
        fg: T.brandNavy,
        bg: alphaOver(T.brandNavy, 0.08, T.surface),
        where: 'Wizard footer · botão Voltar',
      });
    } else {
      out.push({
        name: `${theme} · btn.nav-back — Voltar do wizard`,
        theme,
        fg: '#d2dcff',
        bg: alphaOver(T.brandNavy, 0.24, T.surface),
        where: 'Wizard footer · botão Voltar',
      });
    }

    /* === COMMENT INTERNAL (v5.22) === */
    // Em ambos os temas: bg = mix(warning-fg X%, surface-raised)
    //   light: 8% — fg do texto é --fg (não muted), bg apenas levemente amarelado.
    //   dark:  14%.
    // Testamos --fg (corpo do comentário) E --fg-muted (meta) sobre esse bg.
    {
      const mixPct = theme === 'light' ? 0.08 : 0.14;
      const internalBg = alphaOver(T.warningFg, mixPct, T.surfaceRaised);
      out.push({
        name: `${theme} · comment--internal — corpo (fg sobre warning-bg-mix)`,
        theme, fg: T.fg, bg: internalBg,
        where: 'Etapa 8/ReviewView — comentário interno · corpo',
      });
      out.push({
        name: `${theme} · comment--internal — meta (fg-muted sobre warning-bg-mix)`,
        theme, fg: T.fgMuted, bg: internalBg,
        where: 'Etapa 8/ReviewView — comentário interno · meta',
      });
    }

    /* === INPUT SUFFIX (% no padrão, m³ no volume) === */
    // Light: bg = --bg, color = --fg-muted.
    // Dark:  bg = --surface (sobrescrita), color = --fg-muted.
    out.push({
      name: `${theme} · input-suffix — m³ / %`,
      theme,
      fg: T.fgMuted,
      bg: theme === 'light' ? T.bg : T.surface,
      where: 'Volume (Etapa 5), padrão de moldagem (Etapa 4)',
    });

    /* === BRAND-SUBTITLE (sidebar) === */
    // Texto branco com opacity 82% sobre o gradient navy. Pior caso = navy.
    // Fonte é 10px JetBrains Mono uppercase — ainda exige 4,5:1 (small text).
    out.push({
      name: `${theme} · brand-subtitle — "CONCRETO" 10px sobre gradient`,
      theme,
      fg: alphaOver('#ffffff', 0.82, T.brandNavy),
      bg: T.brandNavy,
      where: 'Sidebar — subtítulo da marca (fonte 10px)',
    });

    /* === KICKER (topbar) === */
    // Mesma cor que --fg-muted sobre --bg, mas em 10px → vale revisar.
    out.push({
      name: `${theme} · kicker — Cadastro/Acompanhamento etc. (10px)`,
      theme,
      fg: T.fgMuted,
      bg: T.bg,
      where: 'Topbar · kicker acima do título da página',
    });

    /* === RADIO-PILL ACTIVE (Etapa 2 — Modelo de preenchimento) === */
    // Light: bg = mix(brand-magenta 6%, --bg). Texto = --fg.
    // Dark:  bg = mix(brand-magenta 14%, --bg).
    {
      const mixPct = theme === 'light' ? 0.06 : 0.14;
      const pillBg = alphaOver(T.brandMagenta, mixPct, T.bg);
      out.push({
        name: `${theme} · radio-pill.active — fg sobre tint magenta`,
        theme, fg: T.fg, bg: pillBg,
        where: 'Etapa 2 — radio Modelo Simplificado/Completo ativo',
      });
      out.push({
        name: `${theme} · radio-pill.active — descrição (fg-muted)`,
        theme, fg: T.fgMuted, bg: pillBg,
        where: 'Etapa 2 — descrição secundária do pill ativo',
      });
    }

    /* === STATUS-STEP ACTIVE (Etapa 8 — fluxo de status) === */
    // bg = --surface (sem tint), só borda magenta. Texto = --fg.
    // Já coberto por "fg sobre surface" mas mantemos para nomear o lugar.
    out.push({
      name: `${theme} · status-step.active — fg sobre surface (borda magenta)`,
      theme, fg: T.fg, bg: T.surface,
      where: 'Etapa 8 — etapa atual no fluxo de status',
    });

    /* === TICKET-NUMBER-BLOCK (modal de envio) === */
    // bg = mix(magenta X%, --bg). Texto = --fg, e número (fonte 22px mono) também --fg.
    {
      const mixPct = theme === 'light' ? 0.06 : 0.14;
      const ticketBg = alphaOver(T.brandMagenta, mixPct, T.bg);
      out.push({
        name: `${theme} · ticket-number-block — número do protocolo`,
        theme, fg: T.fg, bg: ticketBg,
        where: 'Modal Submit · bloco do número do chamado',
      });
    }

    /* === FLOOR CARDS (Etapa 6 — preview com FCK colorido) === */
    // v5.22.15: cores agora usam variáveis *-fg que se adaptam por tema —
    // antes eram hardcoded e 4 pares falhavam (UI 1.4.11 = min 3:1).
    // O texto dentro é --fg (corpo do card). Como a borda é só 5px, o
    // pareamento crítico é texto sobre o fundo, NÃO sobre a borda. Mas
    // verificamos também a borda 5px contra o fundo (3:1 mínimo para
    // graphical/UI components — WCAG 2.1 SC 1.4.11).
    const fckColors: Array<[string, string]> = theme === 'light'
      ? [
          ['fck-15', T.brandPurpleFg],       // --brand-purple-fg light = #3e2d71
          ['fck-20', T.infoFg],              // = #2368a2
          ['fck-25', T.successFg],           // = #1f7a4a
          ['fck-30', T.warningFg],           // = #8d5800
          ['fck-35', T.brandMagenta],        // = #c5117e (light)
          ['fck-40+', T.dangerFg],           // = #b42318
        ]
      : [
          ['fck-15', T.brandPurpleFg],       // = #c2b3ef
          ['fck-20', T.infoFg],              // = #7ab8eb
          ['fck-25', T.successFg],           // = #6fcf97
          ['fck-30', T.warningFg],           // = #f0c674
          ['fck-35', '#e8459e'],             // brand-magenta-light (dark override)
          ['fck-40+', T.dangerFg],           // = #f08c80
        ];
    // v5.22.17 — floor-card em dark agora usa #232a45 (era --surface
    // #181e31, idêntico ao tower-stack). Light continua --bg.
    const floorBg = theme === 'light' ? T.bg : '#232a45';
    out.push({
      name: `${theme} · floor-card — texto sobre fundo`,
      theme, fg: T.fg, bg: floorBg,
      where: 'Etapa 6 — texto interno dos cards de pavimento (FCK · vol)',
    });
    // Bordas FCK contra o fundo do card — UI graphics: WCAG 1.4.11 = 3:1.
    for (const [name, color] of fckColors) {
      out.push({
        name: `${theme} · floor-card ${name} — borda colorida vs fundo`,
        theme, fg: color, bg: floorBg,
        minRatio: 3.0,
        where: `Etapa 6 — borda 5px ${name} (cor de UI, min 3:1)`,
      });
    }

    /* ====================================================================
     * v5.22.17 — pares dos novos overrides em dark.
     * Em light, os tokens continuam iguais — só dark mudou via overrides.
     * Validamos que os novos bg/fg dark ainda passam WCAG AA.
     * ==================================================================== */

    if (theme === 'dark') {
      // Chip em dark — agora bg #2d3554 + texto var(--fg)
      out.push({
        name: `${theme} · chip — fg sobre #2d3554`,
        theme, fg: T.fg, bg: '#2d3554',
        where: 'v5.22.17 — chips de Prévia expandida (Etapa 3)',
      });
      // Chip borda contra fundo (UI 3:1)
      out.push({
        name: `${theme} · chip — borda #6c7ba8 sobre card surface`,
        theme, fg: '#6c7ba8', bg: T.surface,
        minRatio: 3.0,
        where: 'v5.22.17 — borda do chip vs card',
      });
      // Floor card borda contra fundo (UI 3:1) — v5.22.17b: #7986b5
      out.push({
        name: `${theme} · floor-card — borda #7986b5 sobre #232a45`,
        theme, fg: '#7986b5', bg: '#232a45',
        minRatio: 3.0,
        where: 'v5.22.17b — borda do floor-card',
      });
      // Tower-stack — texto fg sobre #1a2034
      out.push({
        name: `${theme} · tower-stack — fg sobre #1a2034`,
        theme, fg: T.fg, bg: '#1a2034',
        where: 'v5.22.17 — tower title sobre tower stack escurecida',
      });
      // Botão default em dark — texto fg + borda #7986b5 (UI 3:1) — v5.22.17b
      out.push({
        name: `${theme} · btn default — borda #7986b5 sobre surface-raised`,
        theme, fg: '#7986b5', bg: T.surfaceRaised,
        minRatio: 3.0,
        where: 'v5.22.17b — borda dos botões secundários em dark',
      });
      // Shortcut default — bg mais saturado
      out.push({
        name: `${theme} · btn.shortcut-default — fg sobre tint 22%`,
        theme,
        fg: T.brandPurpleFg,
        bg: alphaOver(T.brandPurpleFg, 0.22, T.surface),
        where: 'v5.22.17 — shortcuts roxos (+12 horas etc) com tint reforçado',
      });
      out.push({
        name: `${theme} · btn.shortcut-empty — fg sobre tint 22%`,
        theme,
        fg: T.successFg,
        bg: alphaOver(T.successFg, 0.22, T.surface),
        where: 'v5.22.17 — shortcut "+ Vazio" com tint reforçado',
      });
      // Kicker em dark — agora cor #c9c8be sobre bg
      out.push({
        name: `${theme} · kicker — #c9c8be sobre bg`,
        theme, fg: '#c9c8be', bg: T.bg,
        where: 'v5.22.17 — kicker uppercase 10px reforçado',
      });
      // card-description / section-title p — cor #cfcec4
      out.push({
        name: `${theme} · card-description — #cfcec4 sobre surface`,
        theme, fg: '#cfcec4', bg: T.surface,
        where: 'v5.22.17 — descrições secundárias mais opacas',
      });
      // Input em dark — fg sobre #232a45
      out.push({
        name: `${theme} · input — fg sobre #232a45`,
        theme, fg: T.fg, bg: '#232a45',
        where: 'v5.22.17 — fundo dos inputs ligeiramente mais claro',
      });
      // Input borda em dark — #7986b5 sobre #232a45 (UI 3:1) — v5.22.17b
      out.push({
        name: `${theme} · input — borda #7986b5 sobre #232a45`,
        theme, fg: '#7986b5', bg: '#232a45',
        minRatio: 3.0,
        where: 'v5.22.17b — borda do input vs próprio bg',
      });
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

const cases = makeCases();
let passCount = 0;
let failCount = 0;
const failures: string[] = [];

console.log('\n=== Smoke de contraste WCAG · v5.22.15 ===\n');

for (const c of cases) {
  const minRatio = c.minRatio ?? 4.5;
  const ratio = contrastRatio(c.fg, c.bg);
  const pass = ratio >= minRatio;
  const icon = pass ? '✓' : '✗';
  const ratioStr = ratio.toFixed(2).padStart(5, ' ');
  const status = `${icon} ${ratioStr}:1 (min ${minRatio})  ${c.name}`;
  console.log(status);
  if (c.where) console.log(`     ↳ ${c.where}`);
  if (pass) {
    passCount++;
  } else {
    failCount++;
    failures.push(`${c.name} — got ${ratio.toFixed(2)}:1, want ≥${minRatio}:1  (fg=${c.fg}, bg=${c.bg})`);
  }
}

console.log(`\nResultado: ${passCount} OK, ${failCount} FAIL`);

if (failCount > 0) {
  console.error('\nFalhas detalhadas:');
  failures.forEach((f) => console.error(`  • ${f}`));
  console.error('\nSe a falha foi intencional (mudança de paleta aprovada),');
  console.error('atualize os tokens no topo de smoke-contrast.ts.');
  console.error('Senão, ajuste o design-system.css — não baixe o minRatio.\n');
  process.exit(1);
}

console.log('Todos os pares fg/bg críticos passam WCAG AA em ambos os temas.\n');
